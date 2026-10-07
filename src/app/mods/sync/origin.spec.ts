/// <reference types="vitest/globals" />
import { Ref } from '../../model/ref';
import { DownloadAction, downloadModel } from '../../model/tag';
import { cronPlugin } from '../system/script';
import { isReplicating, originInitPlugin, originPushPlugin } from './origin';

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
  const run = async (ref: any, users: any[] = []) => {
    const axios = {
      get: vi.fn(async (url: string, options: any) => ({
        data: users.filter(u => u.origin === options.params.origin && (u.tag === options.params.query || u.tag.startsWith(options.params.query + '/'))),
      })),
      post: vi.fn(async () => ({ data: '' })),
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
    vi.useFakeTimers({ now: new Date('2030-01-01T00:00:00.000Z'), toFake: ['Date'] });
    const { axios, log, error } = await run({
      url: 'spec:o',
      origin: '@main',
      tags: ['+plugin/origin', '+user/chris', '_user/bob', 'public', '_plugin/delta/origin/init'],
      plugins: { '+plugin/origin': { local: '@sub' } },
      metadata: { modified: 'x' },
    }, [{
      tag: '+user/chris', origin: '@main', name: 'Chris', role: 'ROLE_USER', modified: '2020-01-01T00:00:00Z',
      readAccess: ['a'], writeAccess: ['b'], tagReadAccess: ['c'], tagWriteAccess: ['d'],
      pubKey: 'key', authorizedKeys: 'ssh-rsa key', external: { ids: ['x'] },
    }, {
      tag: '+user/chris/child', origin: '@main', name: 'Child',
    }, {
      tag: '_user/bob', origin: '@main.sub', role: 'ROLE_USER', modified: '2021-01-01T00:00:00Z',
    }]);
    vi.useRealTimers();
    expect(error).toBeNull();
    expect(axios.get).toHaveBeenCalledWith('http://jasper.test/pub/api/v1/repl/user', {
      headers: { 'Local-Origin': '@main', 'User-Role': 'ROLE_ADMIN' },
      params: { origin: '@main', query: '+user/chris' },
    });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('http://jasper.test/pub/api/v1/repl/user', [{
      tag: '+user/chris', origin: '@main.sub', name: 'Chris', role: 'ROLE_ADMIN', modified: '2030-01-01T00:00:00.000Z',
      pubKey: 'key', authorizedKeys: 'ssh-rsa key', external: { ids: ['x'] },
    }, {
      tag: '_user/bob', origin: '@main.sub', role: 'ROLE_ADMIN', modified: '2030-01-01T00:00:00.001Z',
    }], {
      headers: { 'Local-Origin': '@main', 'User-Role': 'ROLE_ADMIN' },
      params: { origin: '@main.sub' },
    });
    const bundle = JSON.parse(log.mock.calls[0][0]);
    expect(bundle.ref[0].tags).toEqual(['+plugin/origin', '+user/chris', '_user/bob', 'public']);
    expect(bundle.ref[0].metadata).toBeUndefined();
  });

  it('downloads a template origin ref that pushes to the sub-origin', () => {
    const model = downloadModel(originInitPlugin.config!.advancedActions![0] as DownloadAction, {
      url: 'https://jasper.test/',
      origin: '@main',
      tags: ['+plugin/origin', 'public', '+user/chris', '_user/bob'],
      plugins: { '+plugin/origin': { local: '@sub' } },
    });
    expect(model).toEqual({
      url: 'https://jasper.test/',
      title: '@main.sub',
      tags: ['public', 'internal', '+plugin/cron', '+plugin/origin/push', '+plugin/origin/tunnel'],
      plugins: {
        '+plugin/cron': cronPlugin.defaults,
        '+plugin/origin': { remote: '@main.sub' },
        '+plugin/origin/push': originPushPlugin.defaults,
        '+plugin/origin/tunnel': { remoteUser: '+user/chris@main.sub' },
      },
    });
  });
});
