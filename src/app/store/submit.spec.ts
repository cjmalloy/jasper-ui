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
