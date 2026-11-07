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

describe('ViewStore show remotes on the tags page', () => {
  function createStore(template: string, queryParams = {}) {
    const route = {
      routeSnapshot: signal({
        queryParams,
        firstChild: {
          url: [{ path: 'tags' }],
          params: { template },
        },
      }),
    } as any;
    return new ViewStore(route, {} as any);
  }

  it('hides the toggle and shows remotes for a specific remote origin', () => {
    const store = createStore('science@remote');
    expect(store.showRemotesCheckbox()).toBe(false);
    expect(store.showRemotes()).toBe(true);
  });

  it('hides the toggle and shows remotes for the explicit empty origin', () => {
    const store = createStore('science@');
    expect(store.showRemotesCheckbox()).toBe(false);
    expect(store.showRemotes()).toBe(true);
  });

  it('keeps the toggle for the wildcard origin', () => {
    const store = createStore('@*');
    expect(store.showRemotesCheckbox()).toBe(true);
    expect(store.showRemotes()).toBe(false);
    expect(createStore('@*', { showRemotes: 'true' }).showRemotes()).toBe(true);
  });

  it('keeps the toggle for unqualified tags', () => {
    const store = createStore('science');
    expect(store.showRemotesCheckbox()).toBe(true);
    expect(store.showRemotes()).toBe(false);
  });

  it('keeps the toggle on the Home tab', () => {
    const store = createStore('science@remote', { home: 'true' });
    expect(store.showRemotesCheckbox()).toBe(true);
    expect(store.showRemotes()).toBe(false);
  });
});
