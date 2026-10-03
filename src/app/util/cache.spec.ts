/// <reference types="vitest/globals" />
import { Ref } from '../model/ref';
import { cacheUrlId, isCacheId, refCacheIds, rewriteCacheIds } from './cache';

describe('cache util', () => {
  it('should validate cache IDs', () => {
    expect(isCacheId('abc-123')).toBe(true);
    expect(isCacheId('abc.png')).toBe(true);
    expect(isCacheId('')).toBe(false);
    expect(isCacheId(undefined)).toBe(false);
    expect(isCacheId('..')).toBe(false);
    expect(isCacheId('../etc')).toBe(false);
    expect(isCacheId('a/b')).toBe(false);
  });

  it('should get the cache ID from a cache: URL', () => {
    expect(cacheUrlId('cache:abc')).toBe('abc');
    expect(cacheUrlId('https://example.com')).toBeUndefined();
    expect(cacheUrlId('cache:a/b')).toBeUndefined();
  });

  it('should collect referenced cache IDs', () => {
    const ref: Ref = {
      url: 'cache:url',
      origin: '',
      comment: 'See ![img](cache:comment). Done',
      sources: ['cache:source', 'https://example.com'],
      alternateUrls: ['cache:alt'],
      plugins: {
        '_plugin/cache': { id: 'plugin-cache', mimeType: 'image/png' },
        'plugin/image': { url: 'cache:image' },
        'plugin/gallery': { items: [{ url: 'cache:gallery' }] },
      },
    };
    expect(refCacheIds(ref).sort()).toEqual(['alt', 'comment', 'gallery', 'image', 'plugin-cache', 'source', 'url']);
  });

  it('should ignore noStore caches', () => {
    const ref: Ref = {
      url: 'https://example.com',
      origin: '',
      plugins: { '_plugin/cache': { id: 'x', noStore: true } },
    };
    expect(refCacheIds(ref)).toEqual([]);
  });

  it('should rewrite cache IDs', () => {
    const ref: Ref = {
      url: 'cache:a',
      origin: '',
      comment: 'cache:a and cache:c',
      sources: ['cache:b'],
      alternateUrls: ['cache:c'],
      plugins: {
        '_plugin/cache': { id: 'a', mimeType: 'image/png' },
        'plugin/image': { url: 'cache:b' },
      },
    };
    const result = rewriteCacheIds(ref, new Map([['a', 'x'], ['b', 'y']]));
    expect(result.url).toBe('cache:x');
    expect(result.comment).toBe('cache:x and cache:c');
    expect(result.sources).toEqual(['cache:y']);
    expect(result.alternateUrls).toEqual(['cache:c']);
    expect(result.plugins!['_plugin/cache']).toEqual({ id: 'x', mimeType: 'image/png' });
    expect(result.plugins!['plugin/image']).toEqual({ url: 'cache:y' });
    expect(ref.url).toBe('cache:a');
  });
});
