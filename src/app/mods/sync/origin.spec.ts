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
  const run = async (ref: any, users: Record<string, any> = {}) => {
    const axios = {
      get: vi.fn(async (url: string, options: any) => {
        const user = users[options.params.tag];
        if (!user) throw { response: { status: 404 } };
        return { data: user };
      }),
      post: vi.fn(async () => ({ data: '' })),
      patch: vi.fn(async () => ({ data: '' })),
    };
    const exit = vi.fn(() => { throw new Error('exit'); });
    const require = (module: string) => ({
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify(ref) },
    } as any)[module];
    const fn = new Function('require', 'process', 'console', `return (async () => {${originInitPlugin.config?.script}})()`);
    const error = await fn(require, { env: { JASPER_API: 'http://jasper.test' }, exit }, { log: vi.fn(), error: vi.fn() })
      .then(() => null, (e: any) => e);
    return { axios, exit, error };
  };

  it('fails when local is blank', async () => {
    const { axios, exit } = await run({ url: 'spec:o', origin: '', tags: ['+plugin/origin', '+user/chris'], plugins: { '+plugin/origin': { local: '' } } });
    expect(exit).toHaveBeenCalledWith(1);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('creates or updates admin users in the sub-origin', async () => {
    const { axios, error } = await run({
      url: 'spec:o',
      origin: '@main',
      tags: ['+plugin/origin', '+user/chris', '_user/bob', '+user/admin', 'public'],
      plugins: { '+plugin/origin': { local: '@sub' } },
    }, {
      '_user/bob@main.sub': { tag: '_user/bob', origin: '@main.sub', role: 'ROLE_USER', modified: '2020-01-01T00:00:00Z' },
      '+user/admin@main.sub': { tag: '+user/admin', origin: '@main.sub', role: 'ROLE_ADMIN', modified: '2020-01-01T00:00:00Z' },
    });
    expect(error).toBeNull();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('http://jasper.test/api/v1/user',
      { tag: '+user/chris', origin: '@main.sub', role: 'ROLE_ADMIN' },
      { headers: { 'Local-Origin': '@main', 'User-Role': 'ROLE_ADMIN' } });
    expect(axios.patch).toHaveBeenCalledTimes(1);
    expect(axios.patch).toHaveBeenCalledWith('http://jasper.test/api/v1/user', { role: 'ROLE_ADMIN' }, expect.objectContaining({
      params: { tag: '_user/bob@main.sub', cursor: '2020-01-01T00:00:00Z' },
    }));
  });
});
