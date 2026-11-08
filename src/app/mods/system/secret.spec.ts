/// <reference types="vitest/globals" />
import { getApiKeyScript } from './secret';

describe('getApiKeyScript', () => {
  const run = async (apiKeyTag: string, user?: any, authors = ['+user/alice']) => {
    const axios = {
      get: vi.fn(async (url: string) => {
        if (url.endsWith('/api/v1/user')) {
          if (!user) throw new Error('not found');
          return { data: user };
        }
        return { data: { content: [{ comment: 'api-key' }] } };
      }),
    };
    const fn = new Function(
      'axios',
      'process',
      'console',
      'apiKeyTag',
      'authors',
      `return (async () => {${getApiKeyScript}; return getApiKey(apiKeyTag, authors, '');})()`,
    );
    const result = fn(axios, { env: { JASPER_API: 'http://jasper.test' } }, { error: vi.fn() }, apiKeyTag, authors);
    return { result, axios };
  };

  it('reads protected secrets', async () => {
    const { result, axios } = await run('+plugin/secret/openai');
    await expect(result).resolves.toBe('api-key');
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith('http://jasper.test/api/v1/ref/page', expect.objectContaining({
      params: { query: '+plugin/secret/openai@', size: 1 },
    }));
  });

  it('rejects tags that are not secrets', async () => {
    const { result, axios } = await run('_private/notes');
    await expect(result).rejects.toThrow();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('reads private secrets with tag read access', async () => {
    const { result } = await run('_plugin/secret/openai', { tag: '+user/alice', tagReadAccess: ['_plugin/secret'] });
    await expect(result).resolves.toBe('api-key');
  });

  it('reads private secrets with read access', async () => {
    const { result } = await run('_plugin/secret/openai', { tag: '+user/alice', readAccess: ['_plugin/secret/openai'] });
    await expect(result).resolves.toBe('api-key');
  });

  it('rejects private secrets without read access', async () => {
    const { result, axios } = await run('_plugin/secret/openai', { tag: '+user/alice', tagReadAccess: ['_plugin/secret/other'] });
    await expect(result).rejects.toThrow('No read access');
    expect(axios.get).not.toHaveBeenCalledWith('http://jasper.test/api/v1/ref/page', expect.anything());
  });

  it('rejects private secrets without a user', async () => {
    const { result } = await run('_plugin/secret/openai', undefined, []);
    await expect(result).rejects.toThrow('No read access');
  });
});
