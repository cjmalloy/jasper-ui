/// <reference types="vitest/globals" />
import { ViewStore } from './view';

describe('ViewStore defaults', () => {
  function createStore(queryParams = {}) {
    const route = {
      routeSnapshot: {
        queryParams,
        firstChild: {
          url: [{ path: 'home' }],
          params: {},
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
    expect(store.filter).toEqual(['query/science', 'obsolete']);
  });
});
