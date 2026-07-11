/// <reference types="vitest/globals" />
import { aiQueryPlugin } from './ai';

describe('aiQueryPlugin', () => {
  it('runs the delta script with the default provider', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: [],
    };
    const axios = {
      get: vi.fn(async (_url: string, options: { params: { query: string } }) => {
        const query = options.params.query;
        if (query.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        return { data: { content: [] } };
      }),
    };
    class GoogleGenerativeAI {
      getGenerativeModel() {
        return {
          generateContent: async () => ({
            response: {
              text: () => 'A basic answer',
              candidates: [{ content: { parts: [] } }],
              usageMetadata: {
                promptTokenCount: 2,
                candidatesTokenCount: 3,
                totalTokenCount: 5,
              },
            },
          }),
        };
      }
    }
    const require = (module: string) => ({
      'buffer': { Buffer: globalThis.ArrayBuffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai'] }) },
      '@google/generative-ai': { GoogleGenerativeAI },
    })[module];
    const output = vi.fn();
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${aiQueryPlugin.config?.script}})()`,
    );

    await run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: output, error: vi.fn() });

    const bundle = JSON.parse(output.mock.calls[0][0]);
    expect(bundle.ref[0]).toMatchObject({
      url: 'ai:response',
      comment: 'A basic answer',
      tags: expect.arrayContaining(['+plugin/delta/ai', 'plugin/llm']),
      plugins: {
        'plugin/llm': expect.objectContaining({
          provider: 'gemini',
          model: 'gemini-3.1-pro-preview-customtools',
        }),
      },
    });
  });
});
