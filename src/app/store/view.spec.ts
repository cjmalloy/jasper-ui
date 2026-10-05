/// <reference types="vitest/globals" />
import { ViewStore } from './view';

describe('ViewStore defaults', () => {
  function createStore(queryParams = {}, path = 'home', tag = '') {
    const route = {
      routeSnapshot: {
        queryParams,
        firstChild: {
          url: [{ path }],
          params: { tag },
        },
      },
    } as any;
    const store = new ViewStore(route, {} as any);
    store.exts = [{
      tag: 'config/home',
      origin: '',
      config: {
        defaultSort: ['published,DESC', 'modified,DESC'],
        defaultFilter: ['query/public', 'published/after/P1D'],
      },
    }];
    return store;
  }

  it('loads default sorts and filters from the home Ext', () => {
    const store = createStore();

    expect(store.sort).toEqual(['published,DESC', 'modified,DESC']);
    expect(store.filter).toEqual(['query/public', 'published/after/P1D']);
  });

  it('prefers sort and filter URL parameters over home Ext defaults', () => {
    const store = createStore({
      sort: 'created',
      filter: ['query/science', 'obsolete'],
    });

    expect(store.sort).toEqual(['created']);
    expect(store.urlFilters).toEqual(['query/science', 'obsolete']);
    expect(store.filter).toEqual(['query/science', 'obsolete']);
  });

  it('loads default filters from the tag Ext', () => {
    const store = createStore({}, 'tag', 'science');
    store.exts = [{
      tag: 'science',
      origin: '',
      config: { defaultFilter: ['query/public'] },
    }];

    expect(store.urlFilters).toEqual([]);
    expect(store.filter).toEqual(['query/public']);
    expect(store.urlQueryTags).toEqual(['science']);
    expect(store.queryTags).toEqual(['science', 'public']);
  });
});

describe('ViewStore browser', () => {
  function createStore(path: string) {
    const route = {
      routeSnapshot: {
        queryParams: {},
        firstChild: {
          url: [{ path }],
          params: {},
        },
      },
    } as any;
    return new ViewStore(route, {} as any);
  }

  it('uses /ref outside of browser mode', () => {
    const store = createStore('ref');

    expect(store.browser).toBe(false);
    expect(store.refPath).toBe('/ref');
    expect(store.subviewPath()).toBe('/ref');
    expect(store.subviewPath('comments')).toBe('/ref');
    expect(store.subviewPath('responses')).toBe('/ref');
  });

  it('uses /browse in browser mode', () => {
    const store = createStore('browse');

    expect(store.browser).toBe(true);
    expect(store.refPath).toBe('/browse');
    expect(store.subviewPath()).toBe('/browse');
    expect(store.subviewPath('comments')).toBe('/browse');
    expect(store.subviewPath('thread')).toBe('/browse');
  });

  it('falls back to /ref for subviews unsupported in browser mode', () => {
    const store = createStore('browse');

    for (const subview of ['responses', 'sources', 'errors', 'alts', 'versions']) {
      expect(store.subviewPath(subview)).toBe('/ref');
    }
  });
});
