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

  it('adds generated media embedded in the response as sources', async () => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: ['spec:question'],
      plugins: { 'plugin/llm': { provider: 'gemini', json: true } },
    };
    const axios = {
      get: vi.fn(async (_url: string, options: { params: { query: string } }) => {
        const query = options.params.query;
        if (query.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        return { data: { content: [] } };
      }),
      post: vi.fn().mockResolvedValueOnce({ data: { url: 'cache:image', tags: ['_plugin/cache'] } }),
    };
    class GoogleGenAI {
      models = {
        generateContent: async () => ({
          candidates: [{
            content: {
              parts: [
                { text: JSON.stringify({
                  ref: [{
                    title: 'Here is your image',
                    comment: 'Done: ![Cat](ai:part1)',
                  }, {
                    url: 'ai:part1',
                    title: 'Cat',
                    tags: ['plugin/image'],
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
    expect(bundle.ref[0].comment).toBe('Done: ![Cat](cache:image)');
    expect(bundle.ref[0].sources).toEqual(['spec:question', 'cache:image']);
    const image = bundle.ref.find((r: any) => r.url === 'cache:image');
    expect(image.sources || []).not.toContain('cache:image');
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
      post: vi.fn()
        .mockResolvedValueOnce({ data: { url: 'cache:image', tags: ['_plugin/cache'] } })
        .mockResolvedValueOnce({ data: { url: 'cache:embedded', tags: ['_plugin/cache'] } }),
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
                  }, {
                    url: 'add:embedded',
                    tags: ['plugin/image', 'embedded'],
                    plugins: { 'plugin/image': { url: 'ai:part2' } },
                  }, {
                    url: 'add:missing',
                    tags: ['plugin/image', 'missing'],
                    plugins: { 'plugin/image': { url: 'ai:part' } },
                  }],
                }) },
                { inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } },
                { inlineData: { mimeType: 'image/png', data: Buffer.from('embedded').toString('base64') } },
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
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai', '+plugin/debug', '+user/chris', '_user/bob', 'user/alice', 'users'] }) },
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
    const embedded = bundle.ref.find((r: any) => r.url === 'cache:embedded');
    expect(embedded.tags).toEqual(expect.arrayContaining(['_plugin/cache', ...userTags]));
    const log = bundle.ref.find((r: any) => r.tags.includes('+plugin/log'));
    expect(log.tags).toEqual(expect.arrayContaining(['internal', '+plugin/log', ...userTags]));
    const debug = bundle.ref.find((r: any) => r.title === 'Debugging sources');
    expect(debug.tags).toEqual(expect.arrayContaining(['internal', '+plugin/log', ...userTags]));
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

  const runApiKey = async (apiKeyTag: string, canReadTag = true) => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: ['spec:question'],
      plugins: { 'plugin/llm': { provider: 'openai', apiKeyTag } },
    };
    const axios = {
      get: vi.fn(async (_url: string, options: { headers: Record<string, string>, params: { query?: string } }) => {
        const query = options.params.query;
        if (query?.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query?.startsWith(apiKeyTag) && options.headers['User-Role'] === 'ROLE_ADMIN') return { data: { content: [{ comment: 'api-key' }] } };
        return { data: { content: [] } };
      }),
      head: vi.fn(async (_url: string, options: { validateStatus: (status: number) => boolean }) => {
        const status = canReadTag ? 404 : 403;
        if (!options.validateStatus(status)) throw Object.assign(new Error('Forbidden'), { response: { status } });
        return { status };
      }),
    };
    const create = vi.fn(async () => ({
      output_text: 'Answer',
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
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai', '+user/alice'] }) },
      'openai': OpenAi,
    })[module];
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${aiQueryPlugin.config?.script}})()`,
    );
    const result = run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: vi.fn(), error: vi.fn() });
    const keyRequests = () => axios.get.mock.calls.filter(call => call[1].params.query?.startsWith(apiKeyTag)).map(call => call[1]);
    return { result, keyRequests, clientOptions, head: axios.head };
  };

  it('reads protected API keys without checking tag access', async () => {
    const { result, keyRequests, clientOptions, head } = await runApiKey('+plugin/secret/openai');
    await result;
    expect(head).not.toHaveBeenCalled();
    expect(keyRequests()).toEqual([expect.objectContaining({ headers: expect.objectContaining({ 'User-Role': 'ROLE_ADMIN' }) })]);
    expect(clientOptions).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'api-key' }));
  });

  it('reads private API keys when the author can read the tag', async () => {
    const { result, keyRequests, clientOptions, head } = await runApiKey('_plugin/secret/openai');
    await result;
    expect(head).toHaveBeenCalledWith('http://jasper.test/api/v1/ext', expect.objectContaining({
      headers: expect.objectContaining({ 'User-Tag': '+user/alice' }),
      params: { tag: '_plugin/secret/openai' },
    }));
    expect(keyRequests()).toEqual([expect.objectContaining({ headers: expect.objectContaining({ 'User-Role': 'ROLE_ADMIN' }) })]);
    expect(clientOptions).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'api-key' }));
  });

  it('refuses private API keys when the author cannot read the tag', async () => {
    const { result, keyRequests, clientOptions } = await runApiKey('_plugin/secret/openai', false);
    await expect(result).rejects.toThrow();
    expect(keyRequests()).toHaveLength(0);
    expect(clientOptions).not.toHaveBeenCalled();
  });

  it('refuses public API key tags', async () => {
    const { result, keyRequests, clientOptions, head } = await runApiKey('secret/openai');
    await expect(result).rejects.toThrow('API key tag must be protected or private');
    expect(head).not.toHaveBeenCalled();
    expect(keyRequests()).toHaveLength(0);
    expect(clientOptions).not.toHaveBeenCalled();
  });

  it('refuses API key tags that are queries', async () => {
    const { result, keyRequests, clientOptions, head } = await runApiKey('+plugin/secret/missing|_plugin/secret/alice');
    await expect(result).rejects.toThrow('API key tag must be protected or private');
    expect(head).not.toHaveBeenCalled();
    expect(keyRequests()).toHaveLength(0);
    expect(clientOptions).not.toHaveBeenCalled();
  });

  const runMedia = async (llm: Record<string, unknown>, create: ReturnType<typeof vi.fn>) => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: ['https://example.test/image.png'],
      plugins: { 'plugin/llm': llm },
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
    class OpenAi {
      responses = { create };
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
    return { axios, bundle: JSON.parse(output.mock.calls[0][0]) };
  };
  const openAiAnswer = { output_text: 'Answer', output: [], usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 } };
  const imageParts = (call: any[]) => call[0].input.flatMap((m: any) => m.content).filter((c: any) => c.type === 'input_image');

  it('sends images to OpenAI models it does not know about', async () => {
    const create = vi.fn().mockResolvedValueOnce(openAiAnswer);

    const { bundle } = await runMedia({ provider: 'openai', model: 'gpt-9-nova' }, create);

    expect(create).toHaveBeenCalledTimes(1);
    expect(imageParts(create.mock.calls[0])).toEqual([
      { type: 'input_image', image_url: 'data:image/png;base64,' + Buffer.from('image').toString('base64') },
    ]);
    expect(create.mock.calls[0][0].tools).toEqual([{ type: 'image_generation' }]);
    expect(bundle.ref).not.toContainEqual(expect.objectContaining({ title: 'AI media ingestion' }));
  });

  it('retries OpenAI without images when the model rejects them and logs it', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('image input not supported'), { status: 400 }))
      .mockResolvedValueOnce(openAiAnswer);

    const { bundle } = await runMedia({ provider: 'openai', model: 'gpt-9-nova-mini' }, create);

    expect(create).toHaveBeenCalledTimes(2);
    expect(imageParts(create.mock.calls[0])).toHaveLength(1);
    expect(imageParts(create.mock.calls[1])).toHaveLength(0);
    expect(create.mock.calls[0][0].tools).toBeUndefined();
    expect(bundle.ref[0].comment).toBe('Answer');
    expect(bundle.ref).toContainEqual(expect.objectContaining({
      comment: 'openai (gpt-9-nova-mini) rejected the media input.',
      tags: expect.arrayContaining(['internal', '+plugin/log']),
    }));
  });

  it('skips images for models without vision', async () => {
    const create = vi.fn().mockResolvedValueOnce(openAiAnswer);

    const { axios, bundle } = await runMedia({ provider: 'x', model: 'grok-2' }, create);

    expect(axios.get).not.toHaveBeenCalledWith('http://jasper.test/pub/api/v1/repl/cache', expect.anything());
    expect(imageParts(create.mock.calls[0])).toHaveLength(0);
    expect(bundle.ref).toContainEqual(expect.objectContaining({
      comment: 'x (grok-2) does not support plugin/image input.',
    }));
  });

  it('sends images when vision is on', async () => {
    const create = vi.fn().mockResolvedValueOnce(openAiAnswer);

    const { bundle } = await runMedia({ provider: 'x', model: 'grok-2', vision: true }, create);

    expect(imageParts(create.mock.calls[0])).toHaveLength(1);
    expect(bundle.ref).not.toContainEqual(expect.objectContaining({ title: 'AI media ingestion' }));
  });

  it('does not offer image generation to OpenAI audio models', async () => {
    const create = vi.fn().mockResolvedValueOnce(openAiAnswer);

    await runMedia({ provider: 'openai', model: 'gpt-audio' }, create);

    expect(imageParts(create.mock.calls[0])).toHaveLength(0);
    expect(create.mock.calls[0][0].tools).toBeUndefined();
  });

  const runAnthropic = async (llm: Record<string, unknown>) => {
    const response = {
      url: 'ai:response',
      title: 'Response',
      comment: '',
      tags: ['+plugin/placeholder'],
      sources: [],
      plugins: { 'plugin/llm': llm },
    };
    const axios = {
      get: vi.fn(async (_url: string, options: { params: { query: string } }) => {
        const query = options.params.query;
        if (query.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
        if (query.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
        return { data: { content: [] } };
      }),
    };
    const create = vi.fn().mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Answer' }],
      usage: { input_tokens: 2, output_tokens: 3 },
    });
    class Anthropic {
      messages = { create };
    }
    const require = (module: string) => ({
      'buffer': { Buffer },
      'uuid': { v4: () => 'test-id' },
      'axios': axios,
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:question', tags: ['plugin/delta/ai'] }) },
      '@anthropic-ai/sdk': Anthropic,
    })[module];
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${aiQueryPlugin.config?.script}})()`,
    );
    await run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: vi.fn(), error: vi.fn() });
    return create.mock.calls[0][0];
  };

  it('uses adaptive thinking on current Claude models', async () => {
    const request = await runAnthropic({ provider: 'anthropic', thinking: true });
    expect(request.model).toBe('claude-opus-5-5');
    expect(request.thinking).toEqual({ type: 'adaptive' });
  });

  it('uses a thinking budget on older Claude models', async () => {
    for (const model of ['claude-opus-4-5-20251101', 'claude-sonnet-4-20250514', 'claude-haiku-4-5', 'claude-3-7-sonnet-latest']) {
      const request = await runAnthropic({ provider: 'anthropic', model, thinking: true, thinkingTokens: 1000 });
      expect(request.thinking).toEqual({ type: 'enabled', budget_tokens: 1000 });
    }
    for (const model of ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-fable-5-2', 'claude-haiku-5-5']) {
      const request = await runAnthropic({ provider: 'anthropic', model, thinking: true });
      expect(request.thinking).toEqual({ type: 'adaptive' });
    }
  });

  it('does not configure thinking when it is off', async () => {
    const request = await runAnthropic({ provider: 'anthropic' });
    expect(request).not.toHaveProperty('thinking');
  });
});
