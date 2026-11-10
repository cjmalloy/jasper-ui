/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import JSZip from 'jszip';
import { Ref } from '../model/ref';
import { EmbedService } from '../service/embed.service';
import { DateTime } from 'luxon';
import { bulkFilename, embeddedCacheRefs, mapLimit, queryFilename, safeFilename, zipCache } from './download';
import { getEmbeds } from './editor';

describe('download util', () => {
  it('should make filenames safe on every OS', () => {
    expect(safeFilename('science/physics: a|b?*.zip')).toBe('science_physics_ a_b_.zip');
    expect(safeFilename('  ..hidden\nname.  ')).toBe('hidden name');
    expect(safeFilename('<>.json')).toBe('_.json');
    expect(safeFilename('...')).toBe('download');
    expect(safeFilename('a'.repeat(200) + '.zip', 10)).toBe('aaaaaa.zip');
  });

  it('should limit filenames by bytes without splitting characters', () => {
    const name = safeFilename('日本語'.repeat(30) + '.json');
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(200);
    expect(name).toMatch(/^(日本語)+日?本?\.json$/);
    expect(safeFilename('😀😀😀.zip', 10)).toBe('😀.zip');
  });

  it('should escape reserved Windows names', () => {
    expect(safeFilename('CON.json')).toBe('_CON.json');
    expect(safeFilename('nul')).toBe('_nul');
    expect(safeFilename('com1.tar.zip')).toBe('_com1.tar.zip');
    expect(safeFilename('console.json')).toBe('console.json');
  });

  it('should make readable query filenames', () => {
    expect(queryFilename('science:!funny|math')).toBe('science + !funny or math');
    expect(queryFilename('(science|math):funny@*')).toBe('(science or math) + funny@all');
  });

  it('should name bulk downloads', () => {
    const date = DateTime.fromISO('2026-11-10T03:45:00');
    expect(bulkFilename('Science', undefined, { number: 0, size: 20, totalPages: 1, totalElements: 3 }, date)).toBe('Science - 2026-11-10.zip');
    expect(bulkFilename('Science', ' cats ', { number: 1, size: 20, totalPages: 3, totalElements: 50 }, date)).toBe('Science - search cats - 2026-11-10 (page 2 of 3).zip');
    expect(bulkFilename('', '', undefined, date)).toBe('download - 2026-11-10.zip');
  });

  it('should keep the date and page of long bulk download names', () => {
    const date = DateTime.fromISO('2026-11-10T03:45:00');
    const page = { number: 9, size: 20, totalPages: 12, totalElements: 240 };
    for (const [name, search] of [['a'.repeat(300), 'b'.repeat(300)], ['日本語'.repeat(100), '検索'.repeat(100)], ['science', 'c'.repeat(300)], ['d'.repeat(300), 'cats']]) {
      const filename = bulkFilename(name, search, page, date);
      expect(filename).toMatch(/ - search .+ - 2026-11-10 \(page 10 of 12\)\.zip$/);
      expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(200);
      expect(safeFilename(filename)).toBe(filename);
    }
    expect(bulkFilename('science', 'c'.repeat(300), page, date)).toMatch(/^science - search c+ - /);
    expect(bulkFilename('d'.repeat(300), 'cats', page, date)).toMatch(/^d+ - search cats - /);
  });

  it('should get embedded URLs', () => {
    expect(getEmbeds('![](comment:2) ![img](https://example.com/a.png) [link](comment:3)')).toEqual(['comment:2']);
    expect(getEmbeds('')).toEqual([]);
  });

  it('should ignore images that are not Refs', () => {
    expect(getEmbeds('![](data:image/png;base64,AAAA) ![](blob:abc) ![](/tag/science) ![](tag/science) ![](./a.png) ![](img/a.png) ![](tag:/a)')).toEqual(['tag:/a']);
  });

  it('should include images linking to Ref pages', () => {
    const base = 'https://jasper.example.com/app/';
    expect(getEmbeds('![](/ref/comment:1) ![](https://jasper.example.com/app/ref/comment:2) ![](/app/ref/comment:3) ![](https://other.com/ref/comment:4) ![](https://jasper.example.com/app/tag/science)', undefined, false, base))
      .toEqual(['/ref/comment:1', 'https://jasper.example.com/app/ref/comment:2', '/app/ref/comment:3']);
    expect(getEmbeds('![](/ref/comment:1) ![](https://jasper.example.com/app/ref/comment:2)')).toEqual(['/ref/comment:1']);
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
