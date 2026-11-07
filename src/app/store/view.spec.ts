/// <reference types="vitest/globals" />
import { signal } from '@angular/core';
import { ViewStore } from './view';

describe('ViewStore defaults', () => {
  function createStore(queryParams = {}, path = 'home', tag = '') {
    const route = {
      routeSnapshot: signal({
        queryParams,
        firstChild: {
          url: [{ path }],
          params: { tag },
        },
      }),
    } as any;
    const store = new ViewStore(route, {} as any);
    store.exts.set([{
      tag: 'config/home',
      origin: '',
      config: {
        defaultSort: ['published,DESC', 'modified,DESC'],
        defaultFilter: ['query/public', 'published/after/P1D'],
      },
    }]);
    return store;
  }

  it('loads default sorts and filters from the home Ext', () => {
    const store = createStore();

    expect(store.sort()).toEqual(['published,DESC', 'modified,DESC']);
    expect(store.filter()).toEqual(['query/public', 'published/after/P1D']);
  });

  it('prefers sort and filter URL parameters over home Ext defaults', () => {
    const store = createStore({
      sort: 'created',
      filter: ['query/science', 'obsolete'],
    });

    expect(store.sort()).toEqual(['created']);
    expect(store.urlFilters()).toEqual(['query/science', 'obsolete']);
    expect(store.filter()).toEqual(['query/science', 'obsolete']);
  });

  it('loads default filters from the tag Ext', () => {
    const store = createStore({}, 'tag', 'science');
    store.exts.set([{
      tag: 'science',
      origin: '',
      config: { defaultFilter: ['query/public'] },
    }]);

    expect(store.urlFilters()).toEqual([]);
    expect(store.filter()).toEqual(['query/public']);
    expect(store.urlQueryTags()).toEqual(['science']);
    expect(store.queryTags()).toEqual(['science', 'public']);
  });

  it('copies sort defaults and publishes new mod collections without mutating snapshots', () => {
    const store = createStore();
    const sorts = ['published' as const];
    const searchSorts = ['rank' as const];
    store.clear(sorts, searchSorts);
    expect(store.defaultSort()).not.toBe(sorts);
    expect(store.defaultSearchSort()).not.toBe(searchSorts);

    const changes = store.modChanges();
    const updates = store.modUpdates();
    store.setModChange('plugin/test', true);
    store.addModUpdate('plugin/test');
    expect(changes.size).toBe(0);
    expect(updates.size).toBe(0);
    const changed = store.modChanges();
    const updated = store.modUpdates();

    store.clearModChanges();
    expect(store.modChanges().size).toBe(0);
    expect(store.modUpdates().size).toBe(0);
    expect(changed.get('plugin/test')).toBe(true);
    expect(updated.has('plugin/test')).toBe(true);
  });
});
