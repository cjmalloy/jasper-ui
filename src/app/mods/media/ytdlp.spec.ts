import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Ref } from '../../model/ref';
import { ytdlpDeltaPlugin, ytdlpMetaDeltaPlugin } from './ytdlp';

function lastLine(stderr: string) {
  return JSON.parse(stderr.trim().split('\n').pop()!);
}

function runMetadata(ref: Ref, info: Record<string, unknown>, error?: string) {
  return spawnSync('python3', ['-c', `
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

class Response:
    def __init__(self, ok, body):
        self.ok = ok
        self.status_code = 200 if ok else 409
        self.text = json.dumps(body)
        self.body = body
    def json(self):
        return self.body

def get(url, headers, params, timeout):
    return Response(True, payload['ref'])

def post(url, headers, params, json, timeout):
    calls.append({'url': url, 'headers': headers, 'params': params, 'json': json})
    return Response(True, None)

class YoutubeDL:
    def __init__(self, opts):
        assert opts['skip_download'] is True
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def extract_info(self, url, download):
        embed = payload['ref'].get('plugins', {}).get('plugin/embed', {})
        assert url == (embed.get('url') or payload['ref']['url'])
        assert download is False
        if payload.get('error'):
            raise RuntimeError(payload['error'])
        return payload['info']

sys.modules['yt_dlp'] = types.SimpleNamespace(YoutubeDL=YoutubeDL)
sys.modules['requests'] = types.SimpleNamespace(get=get, post=post)
try:
    exec(payload['script'])
finally:
    print(json.dumps(calls), file=sys.stderr)
  `], {
    input: JSON.stringify({ ref, info, error, script: ytdlpMetaDeltaPlugin.config?.script }),
    encoding: 'utf8',
  });
}

function getRefs(ref: Ref, info: Record<string, unknown>): Ref[] {
  const result = runMetadata(ref, info);
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  const calls = lastLine(result.stderr);
  expect(calls.length).toBeLessThanOrEqual(1);
  let parent = ref;
  if (calls.length) {
    expect(calls[0]).toMatchObject({
      url: 'http://jasper.test/pub/api/v1/repl/ref',
      headers: { 'User-Role': 'ROLE_ADMIN' },
      params: { origin: ref.origin || '' },
    });
    expect(calls[0].json).toHaveLength(1);
    const { modified, ...pushed } = calls[0].json[0];
    expect(modified).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
    expect(pushed.metadata).toBeUndefined();
    parent = { ...ref, ...pushed };
    if (ref.origin === undefined) delete parent.origin;
  }
  return [parent, ...JSON.parse(result.stdout).ref];
}

describe('ytdlpMetaDeltaPlugin', () => {
  const storyboard = {
    format_note: 'storyboard',
    url: 'https://example.test/storyboard-$M.jpg',
    rows: 5,
    columns: 4,
    width: 160,
    height: 90,
  };

  it('creates an ordered playlist with embeddable child refs and their metadata', () => {
    const ref: Ref = {
      url: 'https://example.test/playlist',
      origin: '@local',
      title: 'My playlist',
      tags: ['public', 'public/music', '_user/alice', '+user/alice', 'user/alice', 'music',
        'plugin/embed', 'plugin/embed/custom', '_plugin/delta/ytmeta', '_plugin/delta/ytmeta/retry'],
      sources: ['https://example.test/old'],
      plugins: {
        'plugin/embed': { url: 'https://example.test/embedded-playlist' },
        'plugin/other': { value: 'preserved' },
      },
      metadata: {},
    };
    const refs = getRefs(ref, {
      _type: 'playlist',
      entries: [{
        title: 'First video',
        webpage_url: 'https://example.test/watch/first',
        url: 'https://example.test/temporary-stream',
        duration: 65,
        formats: [storyboard],
      }, {
        title: 'Second video',
        webpage_url: 'https://example.test/watch/second',
        duration: 3600,
      }],
    });

    expect(refs).toHaveLength(3);
    expect(refs[0]).toEqual({
      ...ref,
      tags: ['public', 'public/music', '_user/alice', '+user/alice', 'user/alice', 'music', 'plugin/playlist'],
      sources: ['https://example.test/watch/first', 'https://example.test/watch/second'],
      plugins: { 'plugin/other': { value: 'preserved' } },
    });
    expect(refs[1]).toEqual({
      url: 'https://example.test/watch/first',
      origin: '@local',
      title: 'First video',
      tags: ['plugin/embed', 'public', 'public/music', '_user/alice', '+user/alice', 'user/alice',
        'plugin/duration/pt1m5s', 'plugin/thumbnail/storyboard'],
      plugins: {
        'plugin/embed': { url: 'https://example.test/watch/first' },
        'plugin/thumbnail/storyboard': {
          url: 'https://example.test/storyboard-0.jpg',
          rows: 5, cols: 4, width: 160, height: 90,
        },
      },
    });
    expect(refs[2]).toMatchObject({
      url: refs[0].sources![1],
      title: 'Second video',
      tags: expect.arrayContaining(['plugin/embed', 'plugin/duration/pt1h0s']),
    });
  });

  it('skips unavailable entries and falls back to entry URLs without duplicating playlist tags', () => {
    const refs = getRefs({
      url: 'https://example.test/playlist',
      tags: ['plugin/playlist', '_plugin/delta/ytmeta', '_plugin/delta/ytmeta-other'],
    }, {
      entries: [null, {}, { title: 'Unavailable' }, { url: 'https://example.test/watch/fallback' }],
    });

    expect(refs).toHaveLength(2);
    expect(refs[0].tags).toEqual(['plugin/playlist', '_plugin/delta/ytmeta-other']);
    expect(refs[0].sources).toEqual(['https://example.test/watch/fallback']);
    expect(refs[1]).toEqual({
      url: 'https://example.test/watch/fallback',
      origin: '',
      title: 'Track 4',
      tags: ['plugin/embed'],
      plugins: { 'plugin/embed': { url: 'https://example.test/watch/fallback' } },
    });
  });

  it('creates an empty playlist without requiring existing tags or plugins', () => {
    expect(getRefs({ url: 'https://example.test/empty' }, { _type: 'playlist', entries: [] })).toEqual([{
      url: 'https://example.test/empty',
      tags: ['plugin/playlist'],
      plugins: {},
      sources: [],
    }]);
  });

  it.each([
    'https://example.test/playlist',
    'https://example.test/embedded-playlist',
    'https://example.test/canonical-playlist',
  ])('keeps children distinct when they inherit the playlist webpage URL %s', playlistUrl => {
    const refs = getRefs({
      url: 'https://example.test/playlist',
      tags: ['plugin/embed'],
      plugins: { 'plugin/embed': { url: 'https://example.test/embedded-playlist' } },
    }, {
      webpage_url: 'https://example.test/canonical-playlist',
      entries: [
        { webpage_url: playlistUrl, url: 'https://example.test/first.mp4' },
        { webpage_url: playlistUrl, url: 'https://example.test/second.mp4' },
        { webpage_url: playlistUrl },
        { url: playlistUrl },
      ],
    });

    const sources = ['https://example.test/first.mp4', 'https://example.test/second.mp4'];
    expect(refs[0].sources).toEqual(sources);
    expect(refs.slice(1).map(ref => ref.url)).toEqual(sources);
    expect(refs.slice(1).map(ref => ref.plugins?.['plugin/embed'].url)).toEqual(sources);
  });

  it('preserves single-video behavior and picks the highest resolution storyboard', () => {
    const ref: Ref = {
      url: 'https://example.test/video',
      tags: ['plugin/embed', '_plugin/delta/ytmeta', 'plugin/duration/pt5s', 'plugin/thumbnail/storyboard'],
      plugins: { 'plugin/embed': { url: 'https://example.test/embedded-video' } },
      sources: ['https://example.test/source'],
      metadata: {},
    };
    const refs = getRefs(ref, {
      duration: 3723,
      formats: [
        { ...storyboard, width: 80, height: 45, url: 'https://example.test/low-resolution.jpg' },
        storyboard,
        { format_note: 'video', width: 1920, height: 1080 },
      ],
    });

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      ...ref,
      tags: ['plugin/embed', 'plugin/thumbnail/storyboard', 'plugin/duration/pt1h2m3s'],
      plugins: {
        ...ref.plugins,
        'plugin/thumbnail/storyboard': {
          url: 'https://example.test/storyboard-0.jpg',
          rows: 5, cols: 4, width: 160, height: 90,
        },
      },
    });
  });

  it('preserves existing metadata when no duration or storyboard is returned', () => {
    const ref: Ref = {
      url: 'https://example.test/video',
      tags: ['plugin/embed', 'plugin/duration/pt5s', 'plugin/thumbnail/storyboard'],
      plugins: { 'plugin/thumbnail/storyboard': { url: 'https://example.test/existing.jpg' } },
    };
    expect(getRefs(ref, {})).toEqual([ref]);
  });

  it('still skips scheduled live events without producing refs', () => {
    const result = runMetadata({ url: 'https://example.test/live' }, {}, 'This live event will begin in 2 hours');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('still reports extraction errors without producing refs', () => {
    const result = runMetadata({ url: 'https://example.test/video' }, {}, 'Video unavailable');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr.split('\n')[0])).toEqual({ error: 'Video unavailable' });
  });
});

describe('ytdlpDeltaPlugin', () => {
  function runDownload(ref: Ref, options: { latest?: Ref, pushFailures?: number } = {}) {
    return spawnSync('python3', ['-c', `
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
failures = [payload['pushFailures']]
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
        return Response(True, {'url': 'cache:test', 'origin': params['origin']})
    calls.append({'method': 'post', 'url': url, 'headers': headers, 'params': params, 'json': json})
    if failures[0]:
        failures[0] -= 1
        return Response(False, 'error')
    stored[0] = {**json[0], 'metadata': stored[0].get('metadata')}
    return Response(True, None)

class YoutubeDL:
    def __init__(self, opts):
        self.opts = opts
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def extract_info(self, url, download):
        for hook in self.opts['progress_hooks']:
            hook({'status': 'downloading', 'downloaded_bytes': 37, 'total_bytes': 100})
            hook({'status': 'downloading', 'downloaded_bytes': 37, 'total_bytes': 100})
            hook({'status': 'downloading', 'downloaded_bytes': 50, 'total_bytes_estimate': 200})
            hook({'status': 'downloading', 'downloaded_bytes': 100, 'total_bytes': 100})
            hook({'status': 'finished'})
        with open(self.opts['outtmpl'].replace('%(ext)s', 'mp4'), 'wb') as f:
            f.write(b'video')
        return {'ext': 'mp4'}

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
        latest: options.latest ?? ref,
        pushFailures: options.pushFailures ?? 0,
        script: ytdlpDeltaPlugin.config?.script,
      }),
      encoding: 'utf8',
    });
  }

  const ref: Ref = {
    url: 'https://example.test/video',
    origin: '@local',
    tags: ['public', 'plugin/embed', '_plugin/delta/ytdlp'],
    plugins: { 'plugin/embed': { url: 'https://example.test/embedded-video' } },
    metadata: {},
    modified: '2025-01-01T00:00:00Z' as any,
  };

  const latest: Ref = {
    ...ref,
    title: 'Edited',
    tags: [...ref.tags!, 'music'],
    modified: '2026-02-01T00:00:00Z' as any,
  };

  it('reports sealed progress and saves the Ref through the replicate endpoint', () => {
    const result = runDownload(ref);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ref: [] });
    const calls = lastLine(result.stderr);
    expect(calls.map((c: any) => c.method)).toEqual(['get', 'post', 'get', 'post', 'get', 'post', 'get', 'post', 'get', 'post']);
    const pushes = calls.filter((c: any) => c.method === 'post');
    for (const push of pushes) {
      expect(push).toMatchObject({
        url: 'http://jasper.test/pub/api/v1/repl/ref',
        headers: { 'Local-Origin': '@local', 'User-Role': 'ROLE_ADMIN' },
        params: { origin: '@local' },
      });
      expect(push.json).toHaveLength(1);
      expect(push.json[0].metadata).toBeUndefined();
      expect(push.json[0].modified).not.toBe(ref.modified);
    }
    expect(pushes.slice(0, 4).map((c: any) => c.json[0].tags)).toEqual([
      ['public', 'plugin/embed', '_plugin/delta/ytdlp', 'plugin/progress/0/100', '_seal/delta'],
      ['public', 'plugin/embed', '_plugin/delta/ytdlp', 'plugin/progress/37/100', '_seal/delta'],
      ['public', 'plugin/embed', '_plugin/delta/ytdlp', 'plugin/progress/25/100', '_seal/delta'],
      ['public', 'plugin/embed', '_plugin/delta/ytdlp', 'plugin/progress/99/100', '_seal/delta'],
    ]);
    const saved = pushes[4].json[0];
    expect(saved.tags).toEqual(['public', 'plugin/video']);
    expect(saved.plugins).toEqual({ 'plugin/video': { url: 'cache:test' } });
  });

  it('applies updates to the latest Ref', () => {
    const result = runDownload(ref, { latest });
    expect(result.status, result.stderr).toBe(0);
    const calls = lastLine(result.stderr);
    const saved = calls[calls.length - 1].json[0];
    expect(saved.title).toBe('Edited');
    expect(saved.tags).toEqual(['public', 'music', 'plugin/video']);
    expect(saved.plugins).toEqual({ 'plugin/video': { url: 'cache:test' } });
  });

  it('continues when a progress update fails', () => {
    const result = runDownload(ref, { pushFailures: 1 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain('Error saving Ref: 500');
    expect(JSON.parse(result.stdout)).toEqual({ ref: [] });
  });

  it('reloads the Ref and retries when the final save fails', () => {
    const result = runDownload(ref, { latest, pushFailures: 6 });
    expect(result.status, result.stderr).toBe(0);
    const calls = lastLine(result.stderr);
    expect(calls.slice(8).map((c: any) => c.method)).toEqual(['get', 'post', 'get', 'post', 'get', 'post']);
    expect(calls[calls.length - 1].json[0].tags).toEqual(['public', 'music', 'plugin/video']);
  });

  it('fails when the Ref can never be saved', () => {
    const result = runDownload(ref, { pushFailures: 100 });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Could not save Ref @local https://example.test/video');
  });
});
