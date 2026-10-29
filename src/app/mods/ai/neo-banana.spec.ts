/// <reference types="vitest/globals" />
import { Buffer } from 'node:buffer';
import { neoQueryPlugin } from './neo-banana';

describe('neoQueryPlugin', () => {
  const runScript = async (tags: string[]) => {
    const axios = {
      get: vi.fn(async () => ({ data: { content: [{ comment: 'api-key' }] } })),
      post: vi.fn(async () => ({ data: { url: 'cache:image', tags: ['_plugin/cache'] } })),
    };
    class GoogleGenAI {
      models = {
        generateContent: async () => ({
          candidates: [{
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } }],
            },
          }],
        }),
      };
    }
    const require = (module: string) => ({
      'axios': axios,
      'node:buffer': { Buffer },
      '@google/genai': { GoogleGenAI, Modality: { TEXT: 'TEXT', IMAGE: 'IMAGE' } },
      'fs': { readFileSync: () => JSON.stringify({ url: 'spec:prompt', comment: 'Draw', tags }) },
    })[module];
    const output = vi.fn();
    const run = new Function(
      'require',
      'process',
      'console',
      `return (async () => {${neoQueryPlugin.config?.script}})()`,
    );
    await run(require, { env: { JASPER_API: 'http://jasper.test' } }, { log: output, error: vi.fn() });
    return JSON.parse(output.mock.calls[0][0]);
  };

  it('adds public user tags to non-public images', async () => {
    const bundle = await runScript(['plugin/delta/neo', '+user/chris', '_user/bob']);
    expect(bundle.ref[0].tags).toEqual(expect.arrayContaining(['user/chris', 'user/bob', 'plugin/inbox/user/chris']));
  });

  it('does not add user tags to public images', async () => {
    const bundle = await runScript(['public', 'plugin/delta/neo', '+user/chris']);
    expect(bundle.ref[0].tags).not.toContain('user/chris');
  });
});
