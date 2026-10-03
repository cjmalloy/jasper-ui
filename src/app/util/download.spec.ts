/// <reference types="vitest/globals" />
import { Ref } from '../model/ref';
import { embeddedCacheRefs } from './download';
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
    const result = await embeddedCacheRefs(page, fetchRef);
    expect(result.map(r => r.url)).toEqual(['comment:2']);
    expect(fetched.sort()).toEqual(['comment:2', 'comment:3', 'comment:missing']);
  });

  it('should not duplicate Refs already on the page', async () => {
    const ref: Ref = { url: 'comment:2', origin: '', plugins: { 'plugin/image': { url: 'cache:a' } } };
    const page: Ref[] = [{ url: 'comment:1', origin: '', comment: '![](comment:2)' }, ref];
    expect(await embeddedCacheRefs(page, async () => ref)).toEqual([]);
  });
});
