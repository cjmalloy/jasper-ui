import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Ref } from '../../model/ref';
import { mp3DeltaPlugin } from './mp3';

function runMp3(ref: Ref, info: any, options: { latest?: Ref } = {}) {
  const result = spawnSync('python3', ['-c', `
import copy
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
stored = [copy.deepcopy(payload['latest'])]

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

def get(url, headers, params, timeout):
    calls.append({'method': 'get', 'url': url, 'params': params})
    return Response(True, copy.deepcopy(stored[0]))

def post(url, headers, params, data=None, json=None, timeout=None):
    if url.endswith('/repl/cache'):
        return Response(True, {'url': 'cache:' + params['title'], 'origin': params['origin']})
    calls.append({'method': 'post', 'url': url, 'params': params, 'json': json})
    stored[0] = json[0]
    return Response(True, None)

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
sys.modules['requests'] = types.SimpleNamespace(get=get, post=post)
import time
time.monotonic = monotonic
time.sleep = lambda s: None
try:
    exec(payload['script'])
finally:
    print(json.dumps(calls), file=sys.stderr)
  `], {
    input: JSON.stringify({
      ref,
      info,
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

  it('saves a single track through the replicate endpoint and returns an empty bundle', () => {
    const { bundle, calls } = runMp3(ref, { title: 'Song' });
    expect(bundle).toEqual({ ref: [] });
    expect(calls.map((c: any) => c.method)).toEqual(['get', 'post', 'get', 'post']);
    expect(calls[1]).toMatchObject({ url: 'http://jasper.test/pub/api/v1/repl/ref', params: { origin: '@local' } });
    expect(calls[1].json[0].tags).toEqual([...ref.tags!, 'plugin/progress/37/100', '_seal/delta']);
    const saved = calls[3].json[0];
    expect(saved.url).toBe(ref.url);
    expect(saved.tags).toEqual(['public', 'plugin/audio']);
    expect(saved.plugins).toEqual({ 'plugin/audio': { url: 'cache:Song.mp3' } });
  });

  it('reports playlist progress and saves playlist changes against the latest Ref', () => {
    const latest: Ref = { ...ref, tags: [...ref.tags!, 'music'], modified: '2026-02-01T00:00:00Z' as any };
    const { bundle, calls } = runMp3(ref, {
      title: 'Playlist',
      entries: [{ url: 'https://example.test/a', title: 'A' }, null, { url: 'https://example.test/c', title: 'C' }],
    }, { latest });
    expect(calls.map((c: any) => c.method)).toEqual(['get', 'post', 'get', 'post', 'get', 'post', 'get', 'post']);
    expect(calls.slice(0, 6).filter((c: any) => c.method === 'post').map((c: any) => c.json[0].tags.at(-2))).toEqual([
      'plugin/progress/0/3', 'plugin/progress/1/3', 'plugin/progress/2/3',
    ]);
    const saved = calls[7].json[0];
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
