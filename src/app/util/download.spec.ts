/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import JSZip from 'jszip';
import { MarkdownModule } from 'ngx-markdown';
import { Ref } from '../model/ref';
import { EmbedService } from '../service/embed.service';
import { embeddedCacheRefs, mapLimit, zipCache } from './download';
import { getEmbeds } from './editor';

describe('download util', () => {
  it('should get embedded URLs', () => {
    expect(getEmbeds('![](comment:2) ![img](https://example.com/a.png) [link](comment:3)')).toEqual(['comment:2']);
    expect(getEmbeds('')).toEqual([]);
  });

  it('should include one level of embedded Refs with cache files', async () => {
    const refs: Record<string, Ref> = {
      'comment:2': { url: 'comment:2', origin: '', tags: ['plugin/image'], plugins: { 'plugin/image': { url: 'cache:a' } }, comment: '![](comment:4)' },
      'comment:3': { url: 'comment:3', origin: '', comment: 'no cache' },
      'comment:4': { url: 'comment:4', origin: '', plugins: { 'plugin/image': { url: 'cache:b' } } },
    };
    const fetched: string[] = [];
    const fetchRef = async (url: string) => {
      fetched.push(url);
      if (!refs[url]) throw { status: 404 };
      return refs[url];
    };
    const page: Ref[] = [
      { url: 'comment:1', origin: '', comment: '![](comment:2) ![](comment:3) ![](comment:missing) ![](cache:c)' },
      { url: 'comment:5', origin: '', comment: '![](comment:2)' },
    ];
    const result = await embeddedCacheRefs(page, { fetchRef });
    expect(result.map(r => r.url)).toEqual(['comment:2']);
    expect(fetched.sort()).toEqual(['comment:2', 'comment:3', 'comment:missing']);
  });

  it('should not duplicate Refs already on the page', async () => {
    const ref: Ref = { url: 'comment:2', origin: '', plugins: { 'plugin/image': { url: 'cache:a' } } };
    const page: Ref[] = [{ url: 'comment:1', origin: '', comment: '![](comment:2)' }, ref];
    expect(await embeddedCacheRefs(page, { fetchRef: async () => ref })).toEqual([]);
  });

  it('should limit concurrent requests', async () => {
    let running = 0;
    let max = 0;
    const result = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async n => {
      running++;
      max = Math.max(max, running);
      await new Promise(resolve => setTimeout(resolve, 1));
      running--;
      return n * 2;
    });
    expect(max).toBe(3);
    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  });

  it('should bundle cache files by origin and skip ID collisions', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const zip = new JSZip();
    const fetched: string[] = [];
    await zipCache(zip, [
      { url: 'cache:a', origin: '' },
      { url: 'comment:1', origin: '', comment: '![](cache:a)' },
      { url: 'cache:a', origin: '@other' },
      { url: 'cache:b', origin: '@other' },
    ], async (id, origin) => {
      fetched.push(id + origin);
      return new Blob([id + origin]);
    });
    expect(fetched.sort()).toEqual(['a', 'b@other']);
    expect(Object.keys(zip.files).sort()).toEqual(['cache/', 'cache/a', 'cache/b']);
    expect(await zip.file('cache/a')!.async('string')).toBe('a');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  describe('wiki embeds', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [MarkdownModule.forRoot()],
        providers: [
          provideHttpClient(withXhr(), withInterceptorsFromDi()),
          provideHttpClientTesting(),
          provideRouter([]),
        ],
      }).compileComponents();
      TestBed.inject(EmbedService);
    });

    it('should use the wiki prefix', () => {
      expect(getEmbeds('![[Some page]]')).toEqual(['wiki:Some_page']);
      expect(getEmbeds('![[Some page]]', 'docs:')).toEqual(['docs:Some_page']);
      expect(getEmbeds('![[Some page]]', 'docs:', true)).toEqual([]);
    });

    it('should fetch wiki embeds with a custom prefix', async () => {
      const ref: Ref = { url: 'docs:Some_page', origin: '', plugins: { 'plugin/image': { url: 'cache:a' } } };
      const fetched: string[] = [];
      const result = await embeddedCacheRefs([{ url: 'comment:1', origin: '', comment: '![[Some page]]' }], {
        fetchRef: async url => {
          fetched.push(url);
          return ref;
        },
        wikiPrefix: 'docs:',
      });
      expect(fetched).toEqual(['docs:Some_page']);
      expect(result).toEqual([ref]);
    });
  });
});
