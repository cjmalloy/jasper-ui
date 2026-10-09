import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Ref } from '../../model/ref';
import { mp3DeltaPlugin } from './mp3';

function applyPatch(ref: any, ops: any[]) {
  const result = { ...ref };
  for (const op of ops) {
    const key = op.path.substring(1).replaceAll('~1', '/').replaceAll('~0', '~');
    if (op.op === 'remove') {
      delete result[key];
    } else {
      result[key] = op.value;
    }
  }
  return result;
}

function runMp3(ref: Ref, info: any, options: { progressOk?: boolean, latest?: Ref } = {}) {
  const result = spawnSync('python3', ['-c', `
import io
import json
import os
import sys
import types

payload = json.load(sys.stdin)
sys.stdin = io.StringIO(json.dumps(payload['ref']))
os.environ['JASPER_NODE'] = '/test/bun'
os.environ['JASPER_API'] = 'http://jasper.test'
calls = []
clock = [0]

def monotonic():
    clock[0] += 5
    return clock[0]

class Response:
    def __init__(self, ok, body):
        self.ok = ok
        self.status_code = 200 if ok else 500
        self.text = json.dumps(body)
        self.body = body
    def json(self):
        return self.body

def patch(url, headers, params, timeout, data=None):
    calls.append({'method': 'patch', 'url': url, 'params': params, 'data': data and json.loads(data)})
    if url.endswith('/api/v1/tags'):
        return Response(payload['progressOk'], '2026-01-01T00:00:%02dZ' % len(calls))
    return Response(True, '2026-03-01T00:00:00Z')

def get(url, headers, params, timeout):
    calls.append({'method': 'get', 'url': url, 'params': params})
    return Response(True, payload['latest'])

def post(url, data, headers, params):
    return Response(True, {'url': 'cache:' + params['title'], 'origin': params['origin']})

class YoutubeDL:
    def __init__(self, opts):
        self.opts = opts
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def extract_info(self, url, download):
        if not download:
            return payload['info']
        for hook in self.opts.get('progress_hooks', []):
            hook({'status': 'downloading', 'downloaded_bytes': 37, 'total_bytes': 100})
        with open(self.opts['outtmpl'].replace('%(ext)s', 'mp3'), 'wb') as f:
            f.write(b'audio')
        return {}

sys.modules['yt_dlp'] = types.SimpleNamespace(YoutubeDL=YoutubeDL)
sys.modules['requests'] = types.SimpleNamespace(get=get, patch=patch, post=post)
sys.modules['time'] = types.SimpleNamespace(monotonic=monotonic, sleep=lambda s: None)
try:
    exec(payload['script'])
finally:
    print(json.dumps(calls), file=sys.stderr)
  `], {
    input: JSON.stringify({
      ref,
      info,
      progressOk: options.progressOk ?? true,
      latest: options.latest ?? ref,
      script: mp3DeltaPlugin.config?.script,
    }),
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
  return {
    bundle: JSON.parse(result.stdout),
    calls: JSON.parse(result.stderr.trim().split('\n').pop()!),
  };
}

describe('mp3DeltaPlugin', () => {
  const ref: Ref = {
    url: 'https://example.test/video',
    origin: '@local',
    title: 'Video',
    tags: ['public', 'plugin/embed', '_plugin/delta/mp3'],
    plugins: { 'plugin/embed': { url: 'https://example.test/embedded-video' } },
    modified: '2025-01-01T00:00:00Z' as any,
  };

  it('saves a single track with a JSON patch and returns an empty bundle', () => {
    const { bundle, calls } = runMp3(ref, { title: 'Song' });
    expect(bundle).toEqual({ ref: [] });
    expect(calls.map((c: any) => c.params.tags || c.params.cursor)).toEqual([
      ['-plugin/progress', 'plugin/progress/37/100', '_seal/delta'],
      '2026-01-01T00:00:01Z',
    ]);
    const save = calls[1];
    expect(save.url).toBe('http://jasper.test/api/v1/ref');
    const saved = applyPatch(ref, save.data);
    expect(saved.tags).toEqual(['public', 'plugin/audio']);
    expect(saved.plugins).toEqual({ 'plugin/audio': { url: 'cache:Song.mp3' } });
  });

  it('reloads the Ref when progress fails and saves playlist changes against it', () => {
    const latest: Ref = { ...ref, tags: [...ref.tags!, 'music'], modified: '2026-02-01T00:00:00Z' as any };
    const { bundle, calls } = runMp3(ref, {
      title: 'Playlist',
      entries: [{ url: 'https://example.test/a', title: 'A' }, null, { url: 'https://example.test/c', title: 'C' }],
    }, { progressOk: false, latest });
    expect(calls.map((c: any) => c.method)).toEqual(['patch', 'get', 'patch', 'get', 'patch', 'get', 'patch']);
    expect(calls.slice(0, 6).filter((c: any) => c.params.tags).map((c: any) => c.params.tags[1])).toEqual([
      'plugin/progress/0/3', 'plugin/progress/1/3', 'plugin/progress/2/3',
    ]);
    const save = calls[6];
    expect(save.params.cursor).toBe('2026-02-01T00:00:00Z');
    const saved = applyPatch(latest, save.data);
    expect(saved.tags).toEqual(['public', 'music', 'plugin/playlist']);
    expect(saved.plugins).toEqual({});
    expect(saved.sources).toEqual(['https://example.test/a', 'https://example.test/c']);
    expect(bundle.ref).toEqual([{
      url: 'https://example.test/a',
      origin: '@local',
      title: '01 - A',
      tags: ['plugin/audio', 'public'],
      plugins: { 'plugin/audio': { url: 'cache:01 - A.mp3' } },
    }, {
      url: 'https://example.test/c',
      origin: '@local',
      title: '03 - C',
      tags: ['plugin/audio', 'public'],
      plugins: { 'plugin/audio': { url: 'cache:03 - C.mp3' } },
    }]);
  });
});
