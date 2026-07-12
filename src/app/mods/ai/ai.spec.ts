/// <reference types="vitest/globals" />
import { Buffer } from 'node:buffer';
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

  it('uploads generated media referenced by a plugin URL', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: [],
      plugins: { 'plugin/llm': { json: true } },
    };
    const axios = {
      get: vi.fn(async (_url: string, options: { params: { query: string } }) => {
        const query = options.params.query;
        if (query.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        return { data: { content: [] } };
      }),
      post: vi.fn(async () => ({
        data: {
          url: 'cache:generated',
          tags: ['_plugin/cache'],
          metadata: { ignored: true },
        },
      })),
    };
    class GoogleGenerativeAI {
      getGenerativeModel() {
        return {
          generateContent: async () => ({
            response: {
              text: () => JSON.stringify({
                ref: [{
                  title: 'Generated image',
                  comment: '![Generated](ai:part1)',
                }, {
                  url: 'add:image',
                  tags: ['plugin/image'],
                  plugins: { 'plugin/image': { url: 'ai:part1' } },
                }],
              }),
              candidates: [{
                content: {
                  parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } }],
                },
              }],
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
      'buffer': { Buffer },
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
    expect(axios.post).toHaveBeenCalledOnce();
    expect(bundle.ref[0].comment).toBe('![Generated](cache:generated)');
    expect(bundle.ref[1].plugins['plugin/image'].url).toBe('cache:generated');
  });
});
