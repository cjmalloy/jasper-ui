/// <reference types="vitest/globals" />
import { computed } from '@angular/core';
import { GraphNode } from '../util/graph';
import { GraphStore } from './graph';

describe('GraphStore immutable state', () => {
  it('replaces loaded nodes and remaps selection and D3 object links', () => {
    const store = new GraphStore({} as any);
    const original = { url: 'https://example.com', unloaded: true, x: 12 } as GraphNode;
    const other = { url: 'https://other.example.com' } as GraphNode;
    store.nodes.set([original, other]);
    store.select(original);
    const link = { source: original, target: other };
    store.links.set([link]);
    const previous = store.nodes();
    const selected = store.selected();
    const title = computed(() => store.selected()[0].title);
    expect(title()).toBeUndefined();

    store.load({ url: original.url, title: 'Loaded' });

    const loaded = store.nodes()[0];
    expect(title()).toBe('Loaded');
    expect(loaded).not.toBe(original);
    expect(loaded).toMatchObject({ title: 'Loaded', unloaded: false, x: 12 });
    expect(previous[0]).toBe(original);
    expect(original.unloaded).toBe(true);
    expect(original.title).toBeUndefined();
    expect(selected[0]).toBe(original);
    expect(store.selected()[0]).toBe(loaded);
    expect(store.links()[0].source).toBe(loaded);
    expect(link.source).toBe(original);
  });

  it('replaces not-found nodes and removes references by URL', () => {
    const store = new GraphStore({} as any);
    const original = { url: 'https://example.com', unloaded: true } as GraphNode;
    store.nodes.set([original]);
    store.select(original);
    store.links.set([{ source: original.url, target: original }]);
    store.startLoading(original.url);
    const previous = store.nodes();

    const missing = store.notFound(original.url);

    expect(missing).toMatchObject({ notFound: true, unloaded: false });
    expect(missing).not.toBe(original);
    expect(previous[0].notFound).toBeUndefined();
    expect(store.selected()[0]).toBe(missing);
    expect(store.links()[0].target).toBe(missing);
    expect(store.loading()).toEqual([]);

    store.remove([original]);
    expect(store.nodes()).toEqual([]);
    expect(store.selected()).toEqual([]);
    expect(store.links()).toEqual([]);
  });

  it('pins nodes immutably using isolated layout positions and matches selection by URL', () => {
    const store = new GraphStore({} as any);
    const original = { url: 'https://example.com' } as GraphNode;
    const other = { url: 'https://other.example.com' } as GraphNode;
    store.nodes.set([original, other]);
    const layout = { ...original, x: 12, y: 34 };
    store.select(layout, other);
    expect(store.selected()).toEqual([original, other]);
    expect(store.selected()[0]).toBe(original);
    expect(store.grabNodeOrSelection(layout)).toEqual([original, other]);
    const previous = store.nodes();
    const selected = store.selected();
    const pinned = computed(() => store.selected()[0].pinned);
    expect(pinned()).toBeUndefined();

    store.setPinned(true, layout);

    expect(pinned()).toBe(true);
    expect(store.nodes()[0]).toMatchObject({ pinned: true, fx: 12, fy: 34 });
    expect(store.selected()[0]).toBe(store.nodes()[0]);
    expect(previous[0]).toBe(original);
    expect(selected[0].pinned).toBeUndefined();
    expect(layout.pinned).toBeUndefined();

    store.setPinned(false, layout);
    expect(pinned()).toBe(false);
    expect(store.nodes()[0].fx).toBeUndefined();
    expect(store.nodes()[0].fy).toBeUndefined();
  });
});
