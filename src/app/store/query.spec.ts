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

    expect(refs.page).toHaveBeenCalled();
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
});
