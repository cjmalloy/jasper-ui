/// <reference types="vitest/globals" />
import { autorun } from 'mobx';
import { Subject } from 'rxjs';

import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { ThreadStore } from './thread';

function ref(url: string, source: string, origin = ''): Ref {
  return { url, origin, sources: [source, 'top'] };
}

function page(content: Ref[], number = 0, totalPages = 1): Page<Ref> {
  return {
    content,
    page: {
      number,
      size: content.length,
      totalElements: content.length,
      totalPages,
    },
  };
}

describe('ThreadStore', () => {
  let requests: Subject<Page<Ref>>[];
  let refs: RefService;
  let store: ThreadStore;

  beforeEach(() => {
    requests = [];
    refs = {
      page: vi.fn(() => {
        const request = new Subject<Page<Ref>>();
        requests.push(request);
        return request;
      }),
    } as unknown as RefService;
    store = new ThreadStore(refs);
  });

  it('completes the initial load when the page is empty', () => {
    store.setArgs('top');
    requests[0].next(page([], 0, 0));
    requests[0].complete();

    expect(store.loaded).toBe(true);
    expect(store.pages).toHaveLength(1);
    expect(store.latest).toEqual([]);
  });

  it('allows retrying a failed initial load', () => {
    store.setArgs('top');
    requests[0].error({ status: 500 });

    expect(store.loaded).toBe(false);
    expect(store.error?.status).toBe(500);

    store.loadMore();

    expect(refs.page).toHaveBeenCalledTimes(2);
  });

  it('indexes every loaded comment under its immediate parent', () => {
    const parent = ref('parent', 'top');
    const child = ref('child', 'parent');

    store.setArgs('top');
    requests[0].next(page([parent, child]));
    requests[0].complete();

    expect(store.cache.get('top')).toEqual([parent]);
    expect(store.cache.get('parent')).toEqual([child]);
  });

  it('clears stale load and cache state before loading another thread', () => {
    store.setArgs('top');
    requests[0].next(page([ref('parent', 'top')]));
    requests[0].complete();

    store.setArgs('other');

    expect(store.loaded).toBe(false);
    expect(store.latest).toEqual([]);
    expect(store.cache.size).toBe(0);
  });

  it('starts an uncached ad hoc request from its first page', () => {
    store.setArgs('top');
    requests[0].next(page([ref('parent', 'top')], 0, 2));
    requests[0].complete();

    store.loadMore();
    requests[1].next(page([ref('other', 'top')], 1, 2));
    requests[1].complete();
    store.loadAdHoc('uncached');

    expect(refs.page).toHaveBeenLastCalledWith(expect.objectContaining({
      responses: 'uncached',
      page: 0,
      size: store.defaultBatchSize,
    }));
  });

  it('uses the cached child count for ad hoc pagination', () => {
    for (let i = 0; i < 25; i++) store.add(ref(`child-${i}`, 'parent'));

    store.loadAdHoc('parent');

    expect(refs.page).toHaveBeenLastCalledWith(expect.objectContaining({
      responses: 'parent',
      page: 1,
      size: 20,
    }));
  });

  it('ignores concurrent requests for the same page or source', () => {
    store.setArgs('top');
    store.loadMore();
    expect(refs.page).toHaveBeenCalledTimes(1);

    requests[0].next(page([ref('parent', 'top')], 0, 2));
    requests[0].complete();
    store.loadMore();
    store.loadMore();
    expect(refs.page).toHaveBeenCalledTimes(2);

    store.loadAdHoc('parent');
    store.loadAdHoc('parent');
    expect(refs.page).toHaveBeenCalledTimes(3);
  });

  it('publishes cache updates to observers', () => {
    const counts: number[] = [];
    const dispose = autorun(() => counts.push(store.cache.get('parent')?.length || 0));

    store.add(ref('child', 'parent'));

    expect(counts).toEqual([0, 1]);
    dispose();
  });
});
