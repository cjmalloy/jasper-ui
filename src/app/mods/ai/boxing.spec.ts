/// <reference types="vitest/globals" />
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Plugin } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { boxingDeltaPlugin, boxingJudgePlugin, boxingPreviewPlugin } from './boxing';

const playlist = [
  '#EXTM3U',
  '#EXT-X-PLAYLIST-TYPE:VOD',
  '#EXTINF:10.0,',
  '#EXT-X-PROGRAM-DATE-TIME:2026-01-01T20:00:00.000+0000',
  'seg0.ts',
  '#EXTINF:10.0,',
  'seg1.ts',
  '#EXTINF:5.0,',
  'seg2.ts',
  '#EXT-X-ENDLIST',
].join('\n');

const punches = [
  { chunk_relative_timestamp: '00:04.50', fighter_shorts_color: 'Red', punch_type: 'Hook', delivery_status: 'Clean Land', target_zone: 'Head', severity: 'High', confidence: 'High' },
  { chunk_relative_timestamp: '00:07.00', fighter_shorts_color: 'Blue', punch_type: 'Jab', delivery_status: 'Missed', target_zone: 'Head', severity: 'Low', confidence: 'Medium' },
];

function harness(previews: Ref[] = []) {
  const ffmpeg: string[][] = [];
  const uploads: string[] = [];
  const generateContent = vi.fn(async (req: any) => {
    const schema = req.config.responseSchema;
    if (schema.type === 'ARRAY') return { text: JSON.stringify(punches) };
    if (schema.properties.landed) return { text: JSON.stringify({ landed: false, reason: 'Off the gloves' }) };
    return { text: JSON.stringify({
      scores: [{ fighter_shorts_color: 'Red', points: 10 }, { fighter_shorts_color: 'Blue', points: 9 }],
      winner: 'Red',
      rationale: 'Red was busier. Blue missed often.',
      commentary: ['One', 'Two', 'Three'],
    }) };
  });
  const axios = {
    get: vi.fn(async (url: string, options: any) => {
      if (url === 'https://example.test/round.m3u8') return { data: playlist };
      if (url.endsWith('/repl/cache')) return { data: Buffer.from('video') };
      const query = options.params.query;
      if (query.startsWith('+plugin/secret/')) return { data: { content: [{ comment: 'api-key' }] } };
      if (query === '+plugin/delta/boxing.preview') return { data: { content: previews } };
      return { data: { content: [] } };
    }),
    post: vi.fn(async (url: string, body: Buffer, options: any) => {
      uploads.push(options.params.title);
      return { data: { url: 'cache:' + uploads.length } };
    }),
  };
  const spawn = (cmd: string, args: string[]) => {
    ffmpeg.push(args);
    const p: any = new EventEmitter();
    p.stderr = new EventEmitter();
    // Write every output file so the script can upload it
    args.filter((a, i) => a.startsWith(os.tmpdir()) && args[i - 1] !== '-i').forEach(a => fs.writeFileSync(a, 'video'));
    setTimeout(() => p.emit('close', 0));
    return p;
  };
  async function run(plugin: Plugin, ref: Ref) {
    const output = vi.fn();
    const require = (module: string) => ({
      fs: { ...fs, readFileSync: (f: any, e?: any) => f === 0 ? JSON.stringify(ref) : fs.readFileSync(f, e) },
      os,
      path,
      child_process: { spawn },
      axios,
      uuid: { v4: () => 'test-id' },
      '@google/genai': { GoogleGenAI: class { models = { generateContent }; } },
    } as any)[module];
    const script = new Function('require', 'process', 'console', `return (async () => {${plugin.config?.script}})()`);
    await script(require, { env: { JASPER_API: 'http://jasper.test' }, exit: () => { throw new Error('exit'); } }, { log: output, error: vi.fn() });
    return JSON.parse(output.mock.calls[0][0]).ref as Ref[];
  }
  return { run, ffmpeg, uploads, generateContent };
}

const segment = (index: number, duration = 10) => ({
  index, offset: index * 10, duration, start: new Date(Date.parse('2026-01-01T20:00:00Z') + index * 10_000).toISOString(),
  low: 'cache:low' + index, high: 'cache:high' + index,
});

describe('boxingDeltaPlugin', () => {
  it('cuts the next low and high res clip and creates a preview response', async () => {
    const { run, ffmpeg, uploads } = harness();
    const refs = await run(boxingDeltaPlugin, {
      url: 'https://example.test/round.m3u8',
      tags: ['public', 'plugin/video', 'plugin/delta/boxing'],
      plugins: { 'plugin/boxing': { round: 2, segments: [segment(0)] } },
    });
    expect(ffmpeg).toHaveLength(1);
    const args = ffmpeg[0];
    expect(args[args.indexOf('-ss') + 1]).toBe('10');
    expect(args.join(' ')).toContain('scale=-2:480,fps=10,drawtext=');
    expect(args.join(' ')).toContain('gmtime\\:1767297610.000');
    expect(uploads).toHaveLength(2);
    expect(refs[0].tags).toContain('plugin/delta/boxing');
    expect(refs[0].plugins!['plugin/boxing'].segments).toHaveLength(2);
    expect(refs[0].plugins!['plugin/boxing'].segments[1]).toEqual(expect.objectContaining({
      index: 1, offset: 10, duration: 10, start: '2026-01-01T20:00:10.000Z', low: 'cache:1', high: 'cache:2',
    }));
    expect(refs).toHaveLength(2);
    expect(refs[1].tags).toEqual(expect.arrayContaining(['public', 'internal', 'plugin/delta/boxing.preview']));
    expect(refs[1].sources).toEqual(['https://example.test/round.m3u8']);
    expect(refs[1].plugins!['plugin/boxing'].segments).toHaveLength(2);
  });

  it('stops running and creates the judge response after the last clip', async () => {
    const { run } = harness();
    const refs = await run(boxingDeltaPlugin, {
      url: 'https://example.test/round.m3u8',
      tags: ['public', 'plugin/delta/boxing', 'plugin/boxing'],
      plugins: { 'plugin/boxing': { round: 1, segments: [segment(0), segment(1)] } },
    });
    expect(refs[0].tags).not.toContain('plugin/delta/boxing');
    expect(refs[0].plugins!['plugin/boxing'].segments[2].duration).toBe(5);
    expect(refs.map(r => r.tags!.find(t => t.startsWith('plugin/delta/')))).toEqual([
      undefined, 'plugin/delta/boxing.preview', 'plugin/delta/boxing.judge',
    ]);
    expect(refs[2].plugins!['plugin/boxing'].segments).toHaveLength(3);
  });
});

describe('boxingPreviewPlugin', () => {
  it('only sends clips without a previous analysis to gemini', async () => {
    const previous: Ref = {
      url: 'boxing:old',
      tags: ['+plugin/delta/boxing.preview'],
      plugins: { 'plugin/boxing': { analyzed: [0], events: [{ ...punches[0], chunk_index: 0, offset: 4.5, time: 4.5 }] } },
    };
    const { run, generateContent } = harness([previous]);
    const refs = await run(boxingPreviewPlugin, {
      url: 'boxing:new',
      sources: ['https://example.test/round.m3u8'],
      tags: ['internal', 'plugin/boxing', 'plugin/delta/boxing.preview'],
      plugins: { 'plugin/boxing': { round: 1, segments: [segment(0), segment(1)] } },
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].model).toBe('gemini-2.5-flash');
    expect(refs[0].tags).toContain('+plugin/delta/boxing.preview');
    expect(refs[0].tags).not.toContain('plugin/delta/boxing.preview');
    const data = refs[0].plugins!['plugin/boxing'];
    expect(data.analyzed).toEqual([0, 1]);
    expect(data.events.map((e: any) => e.time)).toEqual([4.5, 14.5, 17]);
    expect(refs[0].comment).toContain('| Red | Hook | Clean Land |');
  });
});

describe('boxingJudgePlugin', () => {
  it('verifies, scores and renders a 30 second highlight video', async () => {
    const { run, ffmpeg, uploads } = harness();
    const refs = await run(boxingJudgePlugin, {
      url: 'boxing:judge',
      sources: ['https://example.test/round.m3u8'],
      tags: ['public', 'plugin/boxing', 'plugin/delta/boxing.judge'],
      plugins: { 'plugin/boxing': { round: 1, segments: [segment(0), segment(1), segment(2, 5)] } },
    });
    const commands = ffmpeg.map(a => a.join(' '));
    expect(commands.filter(c => c.includes(' -t 3 '))).toHaveLength(3);
    expect(commands.filter(c => c.includes('setpts=2*PTS'))).toHaveLength(3);
    const final = ffmpeg[ffmpeg.length - 1];
    expect(final[final.indexOf('-t') + 1]).toBe('30');
    expect(final.join(' ')).toContain('subtitles=');
    expect(uploads).toEqual(['Round 1 highlights.mp4']);
    const ref = refs[0];
    expect(ref.title).toBe('Round 1: Red 10 - Blue 9 (Red)');
    expect(ref.tags).toEqual(expect.arrayContaining(['+plugin/delta/boxing.judge', 'plugin/video']));
    expect(ref.tags).not.toContain('plugin/delta/boxing.judge');
    expect(ref.plugins!['plugin/video'].url).toBe('cache:1');
    const data = ref.plugins!['plugin/boxing'];
    expect(data.events.filter((e: any) => e.verified === false)).toHaveLength(3);
    expect(data.events.every((e: any) => e.delivery_status !== 'Clean Land')).toBe(true);
    expect(data.score.rationale).toBe('Red was busier. Blue missed often.');
    expect(data.highlights).toHaveLength(3);
  });
});
