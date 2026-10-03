/// <reference types="vitest/globals" />
import { RouterStore } from 'mobx-angular';
import { EventBus } from './bus';
import { SubmitStore } from './submit';

describe('SubmitStore', () => {
  let store: SubmitStore;

  beforeEach(() => {
    store = new SubmitStore({} as RouterStore, new EventBus());
    store.addRefs(
      { url: 'https://a.com', title: 'A', upload: true },
      { url: 'https://b.com', title: 'B', upload: true },
    );
  });

  it('should replace an uploaded Ref with the same URL', () => {
    store.setRef({ url: 'https://a.com', title: 'Edited', upload: true });
    expect(store.refs.map(r => r.title)).toEqual(['Edited', 'B']);
  });

  it('should replace an uploaded Ref when the URL was edited', () => {
    store.setRef({ url: 'https://c.com', title: 'C', upload: true }, 'https://a.com');
    expect(store.refs.map(r => r.url)).toEqual(['https://c.com', 'https://b.com']);
    expect(store.refs[0].title).toBe('C');
  });
});
