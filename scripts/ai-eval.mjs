#!/usr/bin/env node
// Opt-in eval for AI models. Runs the real ✨️💭️ AI Query plugin script against real provider
// APIs with a fake Jasper server, so you can check a model before making it the default.
// Costs real API credits and is never run in CI.
//
// Install the provider SDKs once, outside the repo:
//   npm i --prefix /tmp/ai-eval openai @anthropic-ai/sdk @google/genai
// Then run from the repo root:
//   OPENAI_API_KEY=... GEMINI_API_KEY=... node scripts/ai-eval.mjs --modules /tmp/ai-eval \
//     openai:gpt-5.6-sol openai:gpt-6.1-sol gemini:gemini-3.8-flash
//
// API keys are read from <PROVIDER>_API_KEY (OPENAI, ANTHROPIC, X, GEMINI, META, DS, NOUS).
// Pick cases with --cases text,image,json,generate (default: all).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  return args.splice(i, 2)[1];
};
const modules = resolve(option('--modules', '/tmp/ai-eval'));
const cases = option('--cases', 'text,image,json,generate').split(',');
const timeoutMs = Number(option('--timeout', '300000'));
const models = args.map(arg => {
  const [provider, ...model] = arg.split(':');
  return { provider, model: model.join(':') || undefined };
});
if (!models.length) {
  console.error('Usage: node scripts/ai-eval.mjs [--modules DIR] [--cases text,image,json,generate] [--timeout MS] provider[:model] ...');
  process.exit(2);
}

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/app/mods/ai/ai.ts'), 'utf-8');
const literal = source
  .split('export const aiQueryPlugin')[1]
  ?.match(/\n {4}script: `([\s\S]*?)\n {4}`,\n/)?.[1];
if (!literal) throw new Error('Could not find the AI Query plugin script in src/app/mods/ai/ai.ts');
// The script has no interpolations, so evaluating it as a template literal unescapes it exactly like the TS source
const script = new Function('return `' + literal + '`')();
const requireModule = createRequire(join(modules, 'package.json'));

const png = (width, height, pixel) => {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const rows = [];
  for (let y = 0; y < height; y++) {
    rows.push(0);
    for (let x = 0; x < width; x++) rows.push(...pixel(x, y));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const testImage = png(128, 64, x => x < 64 ? [0, 0, 255] : [255, 255, 0]);

const logs = bundle => bundle.ref
  .filter(r => r.tags?.includes('+plugin/log'))
  .map(r => r.comment);
const evalCases = {
  text: {
    prompt: 'What is 17 + 25? Reply with only the number.',
    check: ({ bundle }) => /\b42\b/.test(bundle.ref[0].comment) || 'expected 42, got: ' + bundle.ref[0].comment,
  },
  image: {
    prompt: 'The attached image has two halves. Name the colour of the left half and the colour of the right half.',
    image: true,
    check: ({ bundle }) => {
      const errors = logs(bundle);
      if (errors.length) return errors.join(' ');
      const answer = bundle.ref[0].comment.toLowerCase();
      if (!answer.includes('blue') || !answer.includes('yellow')) return 'expected blue and yellow, got: ' + bundle.ref[0].comment;
      return answer.indexOf('blue') < answer.indexOf('yellow') || 'colours are in the wrong order: ' + bundle.ref[0].comment;
    },
  },
  json: {
    prompt: 'Respond in JSON as a bundle: {"ref":[{"title":"pong","comment":"..."}]} '
      + 'where the comment is the name of the capital of France.',
    json: true,
    check: ({ bundle }) => bundle.ref[0].title?.toLowerCase().includes('pong') && /paris/i.test(bundle.ref[0].comment)
      || 'expected title pong and comment Paris, got: ' + JSON.stringify({ title: bundle.ref[0].title, comment: bundle.ref[0].comment }),
  },
  generate: {
    // Same contract as the 🖼️ image plugin prompt: generated assets are only kept when claimed as ai:partN
    prompt: 'Use your image generation tool to generate an image of a red circle on a white background. '
      + 'Respond in JSON as a bundle: {"ref":[{"title":"Red circle","comment":"![](ai:part1)"},'
      + '{"url":"ai:part1","title":"Red circle","tags":["plugin/image"]}]} where ai:part1 is the generated image.',
    json: true,
    check: ({ bundle, uploads }) => {
      const errors = logs(bundle);
      if (errors.length) return errors.join(' ');
      return uploads.some(type => type.startsWith('image/')) || 'no image was generated';
    },
  },
};

const run = async ({ provider, model }, name) => {
  const test = evalCases[name];
  const apiKey = process.env[provider.toUpperCase() + '_API_KEY'];
  if (!apiKey) return { result: 'SKIP', detail: provider.toUpperCase() + '_API_KEY not set' };
  const question = {
    url: 'eval:' + randomUUID(),
    title: 'Eval ' + name,
    comment: test.prompt,
    tags: ['plugin/delta/ai', '+user/eval'],
  };
  const imageRef = {
    url: 'cache:eval-image',
    title: 'Image',
    comment: '',
    tags: ['public', 'plugin/image'],
  };
  const sources = test.image ? [imageRef, question] : [question];
  const response = {
    url: 'ai:' + randomUUID(),
    title: 'Re: ' + question.title,
    comment: '',
    tags: ['+plugin/placeholder', '+user/eval'],
    sources: sources.map(s => s.url),
    plugins: { 'plugin/llm': { provider, ...(model ? { model } : {}), ...(test.json ? { json: true } : {}) } },
  };
  const uploads = [];
  const axios = {
    get: async (url, options = {}) => {
      const query = options.params?.query;
      if (url.endsWith('/repl/cache')) return { data: testImage, headers: { 'content-type': 'image/png' } };
      if (query?.startsWith('+plugin/placeholder')) return { data: { content: [response] } };
      if (/^[_+]plugin\/secret\//.test(query || '')) return { data: { content: [{ comment: apiKey }] } };
      if (query === '!+system/prompt') return { data: { content: sources } };
      return { data: { content: [] } };
    },
    head: async () => ({ status: 200 }),
    post: async (url, data, options = {}) => {
      uploads.push(options.headers?.['Content-Type'] || '');
      return { data: { url: 'cache:eval-' + randomUUID(), tags: ['_plugin/cache'] } };
    },
  };
  const require = module => ({
    buffer: { Buffer },
    uuid: { v4: randomUUID },
    axios,
    fs: { readFileSync: () => JSON.stringify(question) },
  })[module] || requireModule(module);
  const output = [];
  const errors = [];
  const fakeConsole = {
    log: (...a) => output.push(a.join(' ')),
    error: (...a) => errors.push(a.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join(' ')),
    warn: () => {},
  };
  const started = Date.now();
  try {
    await Promise.race([
      new Function('require', 'process', 'console', `return (async () => {${script}})()`)(
        require, { env: { JASPER_API: 'http://jasper.eval' }, exit: () => { throw new Error('Script exited early'); } }, fakeConsole),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), timeoutMs).unref()),
    ]);
    const bundle = JSON.parse(output.at(-1));
    const check = test.check({ bundle, uploads });
    return { result: check === true ? 'PASS' : 'FAIL', detail: check === true ? '' : check, ms: Date.now() - started };
  } catch (e) {
    return { result: 'FAIL', detail: [e?.message || String(e), ...errors].join(' '), ms: Date.now() - started };
  }
};

const rows = [];
let failed = false;
for (const m of models) {
  for (const name of cases) {
    if (!evalCases[name]) throw new Error('Unknown case ' + name);
    const label = m.provider + ':' + (m.model || '(default)');
    process.stderr.write(label + ' ' + name + '... ');
    const r = await run(m, name);
    process.stderr.write(r.result + '\n');
    failed ||= r.result === 'FAIL';
    rows.push({
      model: label,
      case: name,
      result: r.result,
      seconds: r.ms === undefined ? '' : (r.ms / 1000).toFixed(1),
      detail: String(r.detail).replace(/\s+/g, ' ').slice(0, 120),
    });
  }
}
console.table(rows);
process.exit(failed ? 1 : 0);
