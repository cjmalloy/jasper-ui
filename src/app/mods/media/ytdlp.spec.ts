import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Ref } from '../../model/ref';
import { ytdlpMetaDeltaPlugin } from './ytdlp';

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
exec(payload['script'])
  `], {
    input: JSON.stringify({ ref, info, error, script: ytdlpMetaDeltaPlugin.config?.script }),
    encoding: 'utf8',
  });
}

function getRefs(ref: Ref, info: Record<string, unknown>): Ref[] {
  const result = runMetadata(ref, info);
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout).ref;
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
      metadata: undefined,
      tags: ['public', 'public/music', '_user/alice', '+user/alice', 'user/alice', 'music', 'plugin/playlist'],
      sources: ['https://example.test/watch/first', 'https://example.test/watch/second'],
      plugins: { 'plugin/other': { value: 'preserved' } },
    });
    expect(refs[0]).not.toHaveProperty('metadata');
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
      metadata: undefined,
      tags: ['plugin/embed', 'plugin/thumbnail/storyboard', 'plugin/duration/pt1h2m3s'],
      plugins: {
        ...ref.plugins,
        'plugin/thumbnail/storyboard': {
          url: 'https://example.test/storyboard-0.jpg',
          rows: 5, cols: 4, width: 160, height: 90,
        },
      },
    });
    expect(refs[0]).not.toHaveProperty('metadata');
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
    expect(JSON.parse(result.stderr)).toEqual({ error: 'Video unavailable' });
  });
});
