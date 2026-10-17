/// <reference types="vitest/globals" />
import { Buffer } from 'node:buffer';
import { aiQueryPlugin } from './ai';

describe('aiQueryPlugin', () => {
  it('downloads media and retries without it when the provider rejects it', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: ['https://example.test/image.png'],
      plugins: { 'plugin/llm': { provider: 'gemini' } },
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
      sources: [bundle.ref[0].url],
      comment: expect.stringContaining('rejected the media input'),
      tags: expect.arrayContaining(['internal', '+plugin/log']),
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
      plugins: { 'plugin/llm': { provider: 'gemini', json: true } },
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
      tags: expect.arrayContaining(['_plugin/cache']),
    });
    expect(bundle.ref[0].plugins['plugin/image'].url).toBe(bundle.ref[2].url);
  });

  it('adds public user tags from the parent ref to non-public assets', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: [],
      plugins: { 'plugin/llm': { provider: 'gemini', json: true } },
    };
    const axios = {
      get: vi.fn(async (_url: string, options: { params: { query: string } }) => {
        const query = options.params.query;
        if (query.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        return { data: { content: [] } };
      }),
      post: vi.fn().mockResolvedValueOnce({
        data: { url: 'cache:image', tags: ['_plugin/cache'] },
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
                    tags: ['plugin/image'],
                  }, {
                    url: 'add:private',
                    tags: ['note'],
                  }, {
                    url: 'add:public',
                    tags: ['public', 'note'],
                  }],
                }) },
                { inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } },
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
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai', '+user/chris', '_user/bob', 'user/alice', 'users'] }) },
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
    const userTags = ['user/chris', 'user/bob', 'user/alice'];
    expect(bundle.ref[0].tags).toEqual(expect.arrayContaining(userTags));
    expect(bundle.ref.find((r: any) => r.title === undefined && r.tags.includes('note') && !r.tags.includes('public')).tags)
      .toEqual(expect.arrayContaining(['note', ...userTags]));
    const publicRef = bundle.ref.find((r: any) => r.tags.includes('public'));
    expect(publicRef.tags).toEqual(['public', 'note']);
    const cache = bundle.ref.find((r: any) => r.url === 'cache:image');
    expect(cache.tags).toEqual(expect.arrayContaining(['_plugin/cache', ...userTags]));
    expect(cache.tags).not.toContain('users');
  });

  it('logs unavailable generated media parts', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: [],
      plugins: { 'plugin/llm': { provider: 'gemini', json: true } },
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

  it('generates with Muse Wonder through the Meta Model API', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: ['https://example.test/image.png'],
      plugins: { 'plugin/llm': { provider: 'meta' } },
    };
    const source = {
      url: 'https://example.test/image.png',
      title: 'Image',
      comment: 'What is this?',
      tags: ['public', 'plugin/image'],
    };
    const axios = {
      get: vi.fn(async (url: string, options: { params: { query?: string } }) => {
        const query = options.params.query;
        if (url.endsWith('/repl/cache')) {
          return { data: Buffer.from('image'), headers: { 'content-type': 'image/png' } };
        }
        if (query?.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query?.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'meta-key' }] } };
        if (query === '!+system/prompt') return { data: { content: [source] } };
        return { data: { content: [] } };
      }),
    };
    const create = vi.fn(async () => ({
      output_text: 'A test image',
      usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
    }));
    const clientOptions = vi.fn();
    class OpenAi {
      responses = { create };
      constructor(options: unknown) {
        clientOptions(options);
      }
    }
    const require = (module: string) => ({
      'buffer': { Buffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai'] }) },
      'openai': OpenAi,
    })[module];
    const output = vi.fn();
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${aiQueryPlugin.config?.script}})()`,
    );

    await run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: output, error: vi.fn() });

    expect(axios.get).toHaveBeenCalledWith('http://jasper.test/api/v1/ref/page', expect.objectContaining({
      params: { query: '+plugin/secret/meta@' },
    }));
    expect(clientOptions).toHaveBeenCalledWith({ apiKey: 'meta-key', baseURL: 'https://api.meta.ai/v1' });
    expect(create).toHaveBeenCalledTimes(1);
    const request = (create.mock.calls[0] as unknown[])[0] as any;
    expect(request.model).toBe('muse-wonder-1.0');
    expect(request.input).toContainEqual(expect.objectContaining({
      role: 'user',
      content: expect.arrayContaining([expect.objectContaining({
        type: 'input_image',
        image_url: expect.stringMatching(/^data:image\/png;base64,/),
      })]),
    }));
    const bundle = JSON.parse(output.mock.calls[0][0]);
    expect(bundle.ref[0].comment).toBe('A test image');
    expect(bundle.ref[0].plugins['plugin/llm']).toEqual(expect.objectContaining({
      provider: 'meta',
      model: 'muse-wonder-1.0',
    }));
  });

  const runSearch = async (outputText: string) => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: ['spec:question'],
      plugins: { 'plugin/llm': { provider: 'openai', json: true } },
    };
    const source = {
      url: 'spec:question',
      title: 'Question',
      comment: 'What is the news?',
      tags: ['public', 'plugin/llm/search'],
    };
    const axios = {
      get: vi.fn(async (url: string, options: { params: { query?: string } }) => {
        const query = options.params.query;
        if (query?.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query?.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        if (query === '!+system/prompt') return { data: { content: [source] } };
        return { data: { content: [] } };
      }),
    };
    const create = vi.fn(async () => ({
      output_text: outputText,
      usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
    }));
    class OpenAi {
      responses = { create };
    }
    const require = (module: string) => ({
      'buffer': { Buffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai', 'plugin/llm/search'] }) },
      'openai': OpenAi,
    })[module];
    const output = vi.fn();
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${aiQueryPlugin.config?.script}})()`,
    );
    await run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: output, error: vi.fn() });
    return { create, output };
  };

  it('falls back to text when web search returns non-JSON', async () => {
    const { create, output } = await runSearch('Plain text answer with [citation](https://example.test)');
    const request = (create.mock.calls[0] as unknown[])[0] as any;
    expect(request.tools).toContainEqual({ type: 'web_search' });
    const bundle = JSON.parse(output.mock.calls[0][0]);
    expect(bundle.ref[0].title).toBe('Response');
    expect(bundle.ref[0].comment).toBe('Plain text answer with [citation](https://example.test)');
    expect(bundle.ref[0].tags).toContain('plugin/llm/search');
  });

  it('parses JSON wrapped in a code fence when web search is enabled', async () => {
    const { output } = await runSearch('```json\n{"ref":[{"title":"Fenced","comment":"From search"}]}\n```');
    const bundle = JSON.parse(output.mock.calls[0][0]);
    expect(bundle.ref[0].title).toBe('Fenced');
    expect(bundle.ref[0].comment).toBe('From search');
  });

  it('does not fall back to text when web search returns truncated JSON', async () => {
    await expect(runSearch('{"ref":[{"title":"Cut","comment":"This is cut o')).rejects.toThrow();
  });
});
