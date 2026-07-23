/// <reference types="vitest/globals" />
import {
  hasThumbnail,
  mediaAttachment,
  mediaFilename,
  mediaUrl,
  thumbnailPlugin,
  thumbnailRefs,
  thumbnailUrl,
  thumbnailValue,
} from './ref-media';

describe('Ref media presentation', () => {
  it('derives thumbnail state from editing and persisted refs', () => {
    const ref = { url: 'https://example.com', tags: ['plugin/image'], origin: '@remote' };
    const editRef = { url: 'cache:edited', tags: ['plugin/thumbnail'] };

    expect(hasThumbnail(true, true, false, editRef, ref)).toBe(true);
    expect(hasThumbnail(true, false, false, editRef, ref)).toBe(false);
    expect(hasThumbnail(true, false, true, editRef, ref)).toBe(true);
    expect(thumbnailRefs(true, editRef, ref)).toEqual([{ ...editRef, origin: '@remote' }]);
  });

  it('accepts only object thumbnail configuration', () => {
    expect(thumbnailPlugin({
      url: 'https://example.com',
      plugins: { 'plugin/thumbnail': { color: '#123456' } },
    })).toEqual({ color: '#123456' });
    expect(thumbnailPlugin({
      url: 'https://example.com',
      plugins: { 'plugin/thumbnail': ['invalid'] },
    })).toBeUndefined();
  });

  it('uses explicit, media, and inline thumbnail URLs in priority order', () => {
    const ref = {
      url: 'https://example.com',
      plugins: {
        'plugin/thumbnail': { url: 'https://example.com/thumbnail.jpg' },
        'plugin/image': { url: 'https://example.com/image.jpg' },
      },
    };

    expect(thumbnailUrl(ref, undefined, true)).toBe('https://example.com/thumbnail.jpg');
    expect(thumbnailUrl({
      ...ref,
      plugins: { 'plugin/image': { url: 'https://example.com/image.jpg' } },
    }, undefined, true)).toBe('https://example.com/image.jpg');
    expect(thumbnailUrl({
      ...ref,
      plugins: { 'plugin/thumbnail': { url: 'data:image/svg+xml,<svg></svg>' } },
    }, undefined, false)).toContain('data:image/svg+xml');
    expect(thumbnailUrl(ref, undefined, false)).toBe('');
  });

  it('keeps edit thumbnail values isolated from persisted values', () => {
    const ref = {
      url: 'https://example.com',
      plugins: { 'plugin/thumbnail': { emoji: '📚', radius: 8 } },
    };
    const editRef = {
      url: 'https://example.com',
      plugins: { 'plugin/thumbnail': { emoji: '✏️', radius: 4 } },
    };

    expect(thumbnailValue('emoji', true, editRef, ref)).toBe('✏️');
    expect(thumbnailValue('radius', true, editRef, ref)).toBe(4);
    expect(thumbnailValue('emoji', false, editRef, ref)).toBe('📚');
  });

  it('derives media URLs only for enabled and tagged plugins', () => {
    const ref = {
      url: 'https://example.com/fallback.mp3',
      tags: ['plugin/audio'],
      plugins: { 'plugin/audio': { url: 'cache:audio' } },
    };

    expect(mediaUrl('plugin/audio', true, ref, ref, ref.url)).toBe('cache:audio');
    expect(mediaUrl('plugin/audio', false, ref, ref, ref.url)).toBe(false);
    expect(mediaUrl('plugin/video', true, ref, ref, ref.url)).toBe(false);
  });

  it('builds filenames without duplicating extensions', () => {
    expect(mediaFilename('cache:file.pdf', 'Report', 'Untitled')).toBe('Report.pdf');
    expect(mediaFilename('cache:file.pdf', 'Report.PDF', 'Untitled')).toBe('Report.PDF');
  });

  it('selects the first attachment that requires proxying', () => {
    const fetch = vi.fn((url: string, _origin: string | undefined, filename: string) => `${url}/${filename}`);
    const attachment = mediaAttachment({
      file: false,
      audio: 'https://example.com/audio.mp3',
      video: 'cache:video',
      image: 'cache:image',
      proxyAudio: false,
      proxyVideo: false,
      proxyImage: false,
      url: 'https://example.com',
      origin: '@remote',
      filename: 'file',
      audioFilename: 'audio.mp3',
      videoFilename: 'video.mp4',
      imageFilename: 'image.jpg',
      fetch,
    });

    expect(attachment).toBe('cache:video/video.mp4');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
