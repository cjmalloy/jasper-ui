/// <reference types="vitest/globals" />
import { Ref } from '../../model/ref';
import { isReplicating, originInitPlugin } from './origin';

describe('OriginPlugin', () => {
  const ref = (url: string, origin: string, target: string, source = ''): Ref => ({
    url,
    origin,
    tags: ['+plugin/origin/pull'],
    plugins: {'+plugin/origin': {
        local: target,
        remote: source,
      }
    }
  });
  const api = (url: string, remote = '') => new Map([[url, remote]]);
  it('isReplicating', () => {
    expect(isReplicating('', ref('spec:test', '@other', '@main'), api('spec:test'))).toBeTruthy();
    expect(isReplicating('', ref('spec:test', '@other', '@main'), api('spec:other'))).toBeFalsy();
    expect(isReplicating('@mt', ref('spec:test', '@other', '@main', '@mt'), api('spec:test', '@mt'))).toBeTruthy();
    expect(isReplicating('@mt', ref('spec:test', '@other', '@main', '@diff'), api('spec:test', '@mt'))).toBeFalsy();
  });
});

describe('originInitPlugin', () => {
  const run = async (ref: any, users: Record<string, any> = {}, refs: Record<string, any> = {}) => {
    const axios = {
      get: vi.fn(async (url: string, options: any) => {
        const entity = url.endsWith('/ref')
          ? refs[options.params.url + options.params.origin]
          : users[options.params.tag];
        if (!entity) throw { response: { status: 404 } };
        return { data: entity };
      }),
      post: vi.fn(async () => ({ data: '' })),
      put: vi.fn(async () => ({ data: '' })),
    };
    const exit = vi.fn(() => { throw new Error('exit'); });
    const log = vi.fn();
    const require = (module: string) => ({
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify(ref) },
    } as any)[module];
    const fn = new Function('require', 'process', 'console', `return (async () => {${originInitPlugin.config?.script}})()`);
    const error = await fn(require, { env: { JASPER_API: 'http://jasper.test' }, exit }, { log, error: vi.fn() })
      .then(() => null, (e: any) => e);
    return { axios, exit, log, error };
  };

  it('fails when local is blank', async () => {
    const { axios, exit } = await run({ url: 'spec:o', origin: '', tags: ['+plugin/origin', '+user/chris'], plugins: { '+plugin/origin': { local: '' } } });
    expect(exit).toHaveBeenCalledWith(1);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('copies users as admins in the sub-origin and removes the init tag', async () => {
    const headers = { headers: { 'Local-Origin': '@main', 'User-Role': 'ROLE_ADMIN' } };
    const { axios, log, error } = await run({
      url: 'spec:o',
      origin: '@main',
      tags: ['+plugin/origin', '+user/chris', '_user/bob', 'public', '_plugin/delta/origin/init'],
      plugins: { '+plugin/origin': { local: '@sub' } },
      metadata: { modified: 'x' },
    }, {
      '+user/chris@main': {
        tag: '+user/chris', origin: '@main', name: 'Chris', role: 'ROLE_USER', modified: '2020-01-01T00:00:00Z',
        readAccess: ['a'], writeAccess: ['b'], tagReadAccess: ['c'], tagWriteAccess: ['d'],
        pubKey: 'key', authorizedKeys: 'ssh-rsa key', external: { ids: ['x'] },
      },
      '_user/bob@main.sub': { tag: '_user/bob', origin: '@main.sub', role: 'ROLE_USER', modified: '2021-01-01T00:00:00Z' },
    });
    expect(error).toBeNull();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenCalledWith('http://jasper.test/api/v1/user', {
      tag: '+user/chris', origin: '@main.sub', name: 'Chris', role: 'ROLE_ADMIN',
      pubKey: 'key', authorizedKeys: 'ssh-rsa key', external: { ids: ['x'] },
    }, headers);
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put).toHaveBeenCalledWith('http://jasper.test/api/v1/user', {
      tag: '_user/bob', origin: '@main.sub', role: 'ROLE_ADMIN', modified: '2021-01-01T00:00:00Z',
    }, headers);
    expect(axios.post).toHaveBeenCalledWith('http://jasper.test/api/v1/ref', {
      url: 'spec:o',
      origin: '@main.sub',
      title: '@main.sub',
      tags: ['public', 'internal', '+plugin/origin', '+plugin/origin/push', '+plugin/origin/tunnel'],
      plugins: {
        '+plugin/origin': { remote: '@main.sub' },
        '+plugin/origin/push': { pushOnChange: true, cache: true },
        '+plugin/origin/tunnel': { remoteUser: '+user/chris@main.sub' },
      },
    }, headers);
    const bundle = JSON.parse(log.mock.calls[0][0]);
    expect(bundle.ref[0].tags).toEqual(['+plugin/origin', '+user/chris', '_user/bob', 'public']);
    expect(bundle.ref[0].metadata).toBeUndefined();
  });

  it('does not overwrite an existing template ref in the sub-origin', async () => {
    const { axios, error } = await run({
      url: 'spec:o',
      origin: '',
      tags: ['+plugin/origin', '+user/chris', '_plugin/delta/origin/init'],
      plugins: { '+plugin/origin': { local: '@sub' } },
    }, {
      '+user/chris@sub': { tag: '+user/chris', origin: '@sub', role: 'ROLE_ADMIN', modified: '2021-01-01T00:00:00Z' },
    }, {
      'spec:o@sub': { url: 'spec:o', origin: '@sub' },
    });
    expect(error).toBeNull();
    expect(axios.post).not.toHaveBeenCalledWith('http://jasper.test/api/v1/ref', expect.anything(), expect.anything());
  });
});
