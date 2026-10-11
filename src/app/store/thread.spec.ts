/// <reference types="vitest/globals" />
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { ThreadArgs, ThreadStore } from './thread';

describe('ThreadStore', () => {
  const firstPage = Page.of([{ url: 'comment:first', sources: ['https://example.com'] } as Ref]);
  const secondPage = Page.of([{ url: 'comment:second', sources: ['https://example.com'] } as Ref]);
  let refs: { page: ReturnType<typeof vi.fn> };

  function createStore() {
    refs = { page: vi.fn() };
    refs.page.mockReturnValueOnce(of(firstPage)).mockReturnValue(of(secondPage));
    TestBed.configureTestingModule({
      providers: [
        { provide: RefService, useValue: refs },
      ],
    });
    return TestBed.inject(ThreadStore);
  }

  function watch(store: ThreadStore, args: ThreadArgs) {
    const source = signal<ThreadArgs | undefined>(args);
    TestBed.runInInjectionContext(() => store.watch(source));
    store.pages();
    TestBed.tick();
    return source;
  }

  it('loads the first page for the watched args', () => {
    const store = createStore();
    watch(store, { top: 'https://example.com' });

    expect(refs.page).toHaveBeenCalledOnce();
    expect(refs.page.mock.calls[0][0]).toMatchObject({ responses: 'https://example.com', page: 0 });
    expect(store.pages()).toEqual([firstPage]);
    expect(store.cache().get('https://example.com')).toEqual(firstPage.content);
    expect(store.latest()).toEqual(firstPage.content);
  });

  it('appends pages without mutating published collections', () => {
    const store = createStore();
    watch(store, { top: 'https://example.com' });
    const pages = store.pages();
    const cache = store.cache();

    store.loadMore();

    expect(refs.page.mock.calls[1][0]).toMatchObject({ page: 1 });
    expect(pages).toEqual([firstPage]);
    expect(cache.get('https://example.com')).toEqual(firstPage.content);
    expect(store.pages()).toEqual([firstPage, secondPage]);
    expect(store.latest()).toEqual(secondPage.content);
    expect(store.cache().get('https://example.com')).toEqual([...firstPage.content, ...secondPage.content]);
  });

  it('ignores duplicates and orphans when adding comments', () => {
    const store = createStore();
    watch(store, { top: 'https://example.com' });
    const count = computed(() => store.cache().get('https://example.com')?.length);
    expect(count()).toBe(1);

    store.add(firstPage.content[0], secondPage.content[0], secondPage.content[0], { url: 'comment:orphan' } as Ref);

    expect(count()).toBe(2);
  });

  it('resets when the args change', () => {
    const store = createStore();
    const args = watch(store, { top: 'https://example.com' });
    store.add({ url: 'comment:extra', sources: ['https://example.com'] } as Ref);

    args.set({ top: 'https://other.example.com' });
    store.pages();
    TestBed.tick();

    expect(store.pages()).toEqual([secondPage]);
    expect(store.cache().get('https://example.com')).toEqual(secondPage.content);
  });

  it('discards a load more response for previous args', () => {
    const store = createStore();
    const args = watch(store, { top: 'https://example.com' });
    const stale = new Subject<Page<Ref>>();
    refs.page.mockReturnValueOnce(stale);
    store.loadMore();

    args.set({ top: 'https://other.example.com' });
    store.pages();
    TestBed.tick();
    stale.next(Page.of([{ url: 'comment:stale', sources: ['https://example.com'] } as Ref]));

    expect(store.pages()).toEqual([secondPage]);
    expect(store.latest()).toEqual(secondPage.content);
  });
});
