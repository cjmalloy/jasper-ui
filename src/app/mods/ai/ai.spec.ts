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
    class GoogleGenAI {
      models = {
        generateContent: async () => ({
          candidates: [{ content: { parts: [{ text: 'A basic answer' }] } }],
          usageMetadata: {
            promptTokenCount: 2,
            candidatesTokenCount: 3,
            totalTokenCount: 5,
          },
        }),
      };
    }
    const require = (module: string) => ({
      'buffer': { Buffer: globalThis.ArrayBuffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai'] }) },
      '@google/genai': { GoogleGenAI, Modality: { TEXT: 'TEXT', IMAGE: 'IMAGE' } },
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

  it('downloads media and retries without it when the provider rejects it', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: ['https://example.test/image.png'],
    };
    const source = {
      url: 'https://example.test/image.png',
      title: 'Image',
      comment: '',
      tags: ['public', 'plugin/image'],
    };
    const axios = {
      get: vi.fn(async (url: string, options: { params: { query?: string } }) => {
        const query = options.params.query;
        if (url.endsWith('/repl/cache')) {
          return { data: Buffer.from('image'), headers: { 'content-type': 'image/png' } };
        }
        if (query?.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query?.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        if (query === '!+system/prompt') return { data: { content: [source] } };
        return { data: { content: [] } };
      }),
    };
    const generateContent = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('unsupported media'), { status: 415 }))
      .mockResolvedValueOnce({
        candidates: [{ content: { parts: [{ text: 'Fallback answer' }] } }],
        usageMetadata: {
          promptTokenCount: 2,
          candidatesTokenCount: 3,
          totalTokenCount: 5,
        },
      });
    class GoogleGenAI {
      models = { generateContent };
    }
    const require = (module: string) => ({
      'buffer': { Buffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai'] }) },
      '@google/genai': { GoogleGenAI, Modality: { TEXT: 'TEXT', IMAGE: 'IMAGE' } },
    })[module];
    const output = vi.fn();
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${aiQueryPlugin.config?.script}})()`,
    );

    await run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: output, error: vi.fn() });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[0][0].contents)
      .toEqual(expect.arrayContaining([expect.objectContaining({
        parts: expect.arrayContaining([expect.objectContaining({
          inlineData: expect.objectContaining({ mimeType: 'image/png' }),
        })]),
      })]));
    expect(generateContent.mock.calls[1][0].contents)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({
        parts: expect.arrayContaining([expect.objectContaining({ inlineData: expect.anything() })]),
      })]));
    const bundle = JSON.parse(output.mock.calls[0][0]);
    expect(bundle.ref).toContainEqual(expect.objectContaining({
      sources: [source.url],
      comment: expect.stringContaining('rejected the media input'),
      tags: expect.arrayContaining(['internal', '+plugin/log', 'public']),
    }));
  });

  it('uploads generated media and rewrites its references', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: [],
      modified: 'placeholder-cursor',
      plugins: { 'plugin/llm': { json: true } },
    };
    const axios = {
      get: vi.fn(async (_url: string, options: { params: { query: string } }) => {
        const query = options.params.query;
        if (query.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        return { data: { content: [] } };
      }),
      post: vi.fn()
        .mockResolvedValueOnce({
          data: {
            url: 'cache:image',
            tags: ['_plugin/cache'],
            modified: 'cache-cursor',
            metadata: { ignored: true },
          },
        })
        .mockResolvedValueOnce({
          data: { url: 'cache:pdf', tags: ['_plugin/cache'], metadata: { ignored: true } },
        }),
    };
    class GoogleGenAI {
      models = {
        generateContent: async () => ({
          candidates: [{
            content: {
              parts: [
                { text: JSON.stringify({
                  ref: [{
                    url: 'ai:part1',
                    title: 'Generated image',
                    comment: '![Generated](ai:part1)',
                    sources: ['ai:part1'],
                    tags: ['plugin/image'],
                    plugins: { 'plugin/image': { url: 'ai:part1', width: 512 } },
                  }, {
                    url: 'add:pdf',
                    tags: ['plugin/image'],
                    plugins: { 'plugin/image': { url: 'ai:part2' } },
                  }],
                }) },
                { inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } },
                { inlineData: { mimeType: 'application/pdf', data: Buffer.from('pdf').toString('base64') } },
              ],
            },
          }],
          usageMetadata: {
            promptTokenCount: 2,
            candidatesTokenCount: 3,
            totalTokenCount: 5,
          },
        }),
      };
    }
    const require = (module: string) => ({
      'buffer': { Buffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai'] }) },
      '@google/genai': { GoogleGenAI, Modality: { TEXT: 'TEXT', IMAGE: 'IMAGE' } },
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
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls.map(call => call[1].toString())).toEqual(['image', 'pdf']);
    expect(bundle.ref[0].comment).toBe('![Generated](cache:image)');
    expect(bundle.ref[0].sources).toContain('cache:image');
    expect(bundle.ref[0].plugins['plugin/image']).toEqual({
      url: 'cache:image',
      width: 512,
    });
    expect(bundle.ref[0]).toMatchObject({
      url: 'ai:response',
      modified: 'placeholder-cursor',
    });
    expect(bundle.ref[1].plugins['plugin/image'].url).toBe('cache:pdf');
    expect(bundle.ref[2]).toMatchObject({
      url: 'cache:image',
      modified: 'cache-cursor',
      tags: expect.arrayContaining(['_plugin/cache', 'plugin/image']),
    });
    expect(bundle.ref[0].plugins['plugin/image'].url).toBe(bundle.ref[2].url);
  });

  it('logs unavailable generated media parts', async () => {
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
      post: vi.fn(),
    };
    class GoogleGenAI {
      models = {
        generateContent: async () => ({
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({
                ref: [{
                  title: 'Missing image',
                  comment: '![Missing](ai:part2) ![Invalid](ai:part)',
                  sources: ['ai:part'],
                  tags: ['plugin/image'],
                  plugins: { 'plugin/image': { url: 'ai:part' } },
                }, {
                  url: 'ai:part2',
                  tags: ['plugin/image'],
                }, {
                  url: 'ai:part',
                  tags: ['plugin/image'],
                }],
              }) }],
            },
          }],
          usageMetadata: {
            promptTokenCount: 2,
            candidatesTokenCount: 3,
            totalTokenCount: 5,
          },
        }),
      };
    }
    const require = (module: string) => ({
      'buffer': { Buffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai'] }) },
      '@google/genai': { GoogleGenAI, Modality: { TEXT: 'TEXT', IMAGE: 'IMAGE' } },
    })[module];
    const output = vi.fn();
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${aiQueryPlugin.config?.script}})()`,
    );

    await run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: output, error: vi.fn() });

    expect(axios.post).not.toHaveBeenCalled();
    const bundle = JSON.parse(output.mock.calls[0][0]);
    expect(bundle.ref[0].comment).not.toContain('(ai:part)');
    expect(bundle.ref[0].sources).not.toContain('ai:part');
    expect(bundle.ref[0].tags).not.toContain('plugin/image');
    expect(bundle.ref[0].plugins['plugin/image']).toBeUndefined();
    expect(bundle.ref).not.toContainEqual(expect.objectContaining({ url: 'ai:part' }));
    expect(bundle.ref).toContainEqual(expect.objectContaining({
      sources: ['ai:part2'],
      comment: 'AI response referenced unavailable media asset ai:part2',
      tags: expect.arrayContaining(['internal', '+plugin/log']),
    }));
    expect(bundle.ref).toContainEqual(expect.objectContaining({
      sources: ['ai:part'],
      comment: 'AI response referenced unavailable media asset ai:part',
      tags: expect.arrayContaining(['internal', '+plugin/log']),
    }));
  });
});
