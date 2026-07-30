/// <reference types="vitest/globals" />
import { of } from 'rxjs';

import { Page } from '../model/page';
import { RefService } from '../service/api/ref.service';
import { QueryStore } from './query';

describe('QueryStore', () => {
  it('loads the page and related refs when sources are set', () => {
    const source = { url: 'https://example.com/source', title: 'Source' };
    const refs = {
      page: vi.fn(() => of(Page.of([]))),
      getCurrent: vi.fn(() => of(source)),
    } as unknown as RefService;
    const store = new QueryStore(refs);

    store.setArgs({ query: 'test', sources: source.url });

    expect(refs.page).toHaveBeenCalledOnce();
    expect(refs.getCurrent).toHaveBeenCalledWith(source.url);
    expect(store.sourcesOf).toEqual(source);
  });

  it('loads related refs without triggering the page query via setRelatedArgs', () => {
    const source = { url: 'https://example.com/source', title: 'Source' };
    const refs = {
      page: vi.fn(() => of(Page.of([]))),
      getCurrent: vi.fn(() => of(source)),
    } as unknown as RefService;
    const store = new QueryStore(refs);

    store.setRelatedArgs({ query: 'kanban/test', sources: source.url });

    expect(refs.page).not.toHaveBeenCalled();
    expect(refs.getCurrent).toHaveBeenCalledWith(source.url);
    expect(store.sourcesOf).toEqual(source);
  });

  it('leaves ordinary date-sorted page requests unchanged', () => {
    const refs = {
      page: vi.fn(() => of(Page.of([]))),
      getCurrent: vi.fn(),
    } as unknown as RefService;
    const store = new QueryStore(refs);
    const args = { query: 'test', sort: ['published,DESC' as const] };

    store.setArgs(args);

    expect(refs.page).toHaveBeenCalledOnce();
    expect(refs.page).toHaveBeenCalledWith(args);
    expect(store.args).toBe(args);
  });

  it('uses a queued cursor request only for its matching page navigation', () => {
    const offsetPage = Page.of([]);
    const cursorPage = Page.of([{ url: 'https://example.com/cursor' }]);
    const page = vi.fn(() => of(offsetPage));
    const refs = {
      page,
      getCurrent: vi.fn(),
    } as unknown as RefService;
    const store = new QueryStore(refs);
    const args = { query: 'test', page: 0, size: 2, sort: ['published,DESC' as const] };

    store.setArgs(args);
    page.mockClear();
    store.queueCursorPage(1, of(cursorPage));
    store.setArgs({ ...args, page: 1 });

    expect(page).not.toHaveBeenCalled();
    expect(store.page).toBe(cursorPage);

    store.queueCursorPage(2, of(cursorPage));
    const directArgs = { ...args, page: 3 };
    store.setArgs(directArgs);

    expect(page).toHaveBeenCalledOnce();
    expect(page).toHaveBeenCalledWith(directArgs);
    expect(store.page).toBe(offsetPage);
  });
});
