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
    expect(store.urlFilters).toEqual([]);
    expect(store.filter).toEqual(['query/public', 'published/after/P1D']);
    expect(store.urlQueryTags).toEqual([]);
    expect(store.queryTags).toEqual(['public']);
  });

  it('prefers sort and filter URL parameters over home Ext defaults', () => {
    const store = createStore({
      sort: 'created',
      filter: ['query/science', 'obsolete'],
    });

    expect(store.sort).toEqual(['created']);
    expect(store.urlFilters).toEqual(['query/science', 'obsolete']);
    expect(store.filter).toEqual(['query/science', 'obsolete']);
    expect(store.urlQueryTags).toEqual(['science']);
    expect(store.queryTags).toEqual(['science']);
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
