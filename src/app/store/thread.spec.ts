/// <reference types="vitest/globals" />
import { computed } from '@angular/core';
import { of } from 'rxjs';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { ThreadStore } from './thread';

describe('ThreadStore immutable cache', () => {
  function createStore() {
    return new ThreadStore({ page: vi.fn(() => of(Page.of([]))) } as unknown as RefService);
  }

  it('copies maps and response arrays while retaining duplicates and unrelated sources', () => {
    const store = createStore();
    const first = { url: 'comment:first', sources: ['https://example.com'] } as Ref;
    const second = { url: 'comment:second', sources: first.sources } as Ref;
    const other = { url: 'comment:other', sources: ['https://other.example.com'] } as Ref;
    store.add(first, other);
    const previous = store.cache();
    const responses = previous.get(first.sources![0])!;
    const count = computed(() => store.cache().get(first.sources![0])?.length);
    expect(count()).toBe(1);

    store.add(first, second, second, { url: 'comment:orphan' } as Ref);

    expect(count()).toBe(2);
    expect(store.cache()).not.toBe(previous);
    expect(responses).toEqual([first]);
    expect(store.cache().get(first.sources![0])).toEqual([first, second]);
    expect(store.cache().get(other.sources![0])).toBe(previous.get(other.sources![0]));
  });

  it('appends pages and clears without mutating published collections', () => {
    const store = createStore();
    const first = Page.of([{ url: 'comment:first', sources: ['https://example.com'] } as Ref]);
    store.addPage(first);
    const pages = store.pages();
    const cache = store.cache();
    const latest = store.latest();
    const second = Page.of([{ url: 'comment:second', sources: ['https://example.com'] } as Ref]);
    store.addPage(second);

    expect(pages).toEqual([first]);
    expect(cache.get('https://example.com')).toEqual(first.content);
    expect(latest).toEqual(first.content);
    expect(latest).not.toBe(first.content);
    expect(store.pages()).toEqual([first, second]);

    store.clear();
    expect(store.pages()).toEqual([]);
    expect(store.cache().size).toBe(0);
    expect(store.latest()).toEqual([]);
    expect(cache.size).toBe(1);
  });
});
