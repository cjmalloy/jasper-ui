/// <reference types="vitest/globals" />
import JSZip from 'jszip';
import { Subject } from 'rxjs';
import { zippedCacheFiles } from '../util/zip';
import { SubmitStore } from './submit';

describe('SubmitStore cache files', () => {
  it('keeps the first cache file when two zips share an ID', async () => {
    const store = new SubmitStore({} as any, { events: new Subject() } as any);
    const first = new JSZip();
    first.file('cache/a', 'first');
    const second = new JSZip();
    second.file('cache/a', 'second');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    store.addCacheFiles(zippedCacheFiles(first));
    store.addCacheFiles(zippedCacheFiles(second));

    expect(await store.cacheFiles.get('a')!.async('string')).toBe('first');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a'));
    warn.mockRestore();
  });
});

describe('SubmitStore location', () => {
  const store = (queryParams: any) => new SubmitStore({ routeSnapshot: { queryParams } } as any, { events: new Subject() } as any);

  it('reads the location param', () => {
    expect(store({ location: '1,2', map: '3,4,5' }).location).toEqual([1, 2]);
  });

  it('defaults to the map view center for plugin/geo/point', () => {
    expect(store({ tag: 'plugin/geo/point', map: '3,4,5' }).location).toEqual([3, 4]);
  });

  it('ignores the map view without plugin/geo/point', () => {
    expect(store({ tag: 'public', map: '3,4,5' }).location).toBeUndefined();
  });
});
