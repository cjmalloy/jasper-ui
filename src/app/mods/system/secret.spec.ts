/// <reference types="vitest/globals" />
import { getApiKeyScript } from './secret';

describe('getApiKeyScript', () => {
  const run = (apiKeyTag: string, authors: string[]) => {
    const axios = {
      get: vi.fn(async () => ({ data: { content: [{ comment: 'api-key' }] } })),
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

  it('reads secrets as the author', async () => {
    const { result, axios } = run('_plugin/secret/openai', ['+user/alice']);
    await expect(result).resolves.toBe('api-key');
    expect(axios.get).toHaveBeenCalledWith('http://jasper.test/api/v1/ref/page', {
      headers: { 'Local-Origin': 'default', 'User-Tag': '+user/alice' },
      params: { query: '_plugin/secret/openai@', size: 1 },
    });
  });

  it('does not escalate without an author', async () => {
    const { result, axios } = run('+plugin/secret/openai', []);
    await expect(result).resolves.toBe('api-key');
    expect(axios.get).toHaveBeenCalledWith('http://jasper.test/api/v1/ref/page', expect.objectContaining({
      headers: { 'Local-Origin': 'default', 'User-Tag': '' },
    }));
  });
});
