/// <reference types="vitest/globals" />
import { computed } from '@angular/core';
import JSZip from 'jszip';
import { Ext } from '../model/ext';
import { Ref } from '../model/ref';
import { zippedCacheFiles } from '../util/zip';
import { EventBus } from './bus';
import { SubmitStore } from './submit';

describe('SubmitStore immutable state', () => {
  const createStore = () => new SubmitStore({} as any, new EventBus());

  it('copies provided collection arrays', () => {
    const store = createStore();
    const refs = [{ url: 'https://example.com' } as Ref];
    const exts = [{ tag: 'science' } as Ext];
    const files = [new File([], 'example.txt')];

    store.clearUpload(refs, exts);
    store.setEmbedFiles(files);

    expect(store.refs()).toEqual(refs);
    expect(store.refs()).not.toBe(refs);
    expect(store.exts()).toEqual(exts);
    expect(store.exts()).not.toBe(exts);
    expect(store.embedFiles()).toEqual(files);
    expect(store.embedFiles()).not.toBe(files);
  });

  it('updates ref tags and upload progress without changing existing snapshots', () => {
    const store = createStore();
    const ref = { url: 'https://example.com', tags: ['science'] } as Ref;
    store.addRefs(ref);
    const refs = store.refs();
    store.tagRefs(['math', '-science']);

    expect(refs).toEqual([ref]);
    expect(ref.tags).toEqual(['science']);
    expect(store.refs()[0].tags).toEqual(['math']);

    const file = new File([], 'example.txt');
    const caching = store.caching();
    const uploads = computed(() => store.uploads().length);
    expect(uploads()).toBe(0);
    store.setCaching(file, { name: file.name, progress: 1 });
    expect(uploads()).toBe(1);
    expect(caching.size).toBe(0);
    const progress = store.caching();
    store.setCaching(file, { name: file.name, progress: 2 });
    expect(progress.get(file)?.progress).toBe(1);
    store.removeCaching(file);
    expect(uploads()).toBe(0);
    expect(progress.size).toBe(1);
  });
});

describe('SubmitStore cache files', () => {
  it('keeps the first cache file when two zips share an ID', async () => {
    const store = new SubmitStore({} as any, new EventBus());
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
