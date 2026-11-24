/// <reference types="vitest/globals" />
import { isStuck } from './floating.directive';

describe('isStuck', () => {
  let parent: HTMLElement;
  let island: HTMLElement;
  let next: HTMLElement;

  const rect = (el: HTMLElement, top: number, bottom: number) =>
    el.getBoundingClientRect = () => ({ top, bottom } as DOMRect);

  beforeEach(() => {
    parent = document.createElement('div');
    parent.style.display = 'grid';
    parent.style.rowGap = '4px';
    island = document.createElement('span');
    island.style.position = 'sticky';
    next = document.createElement('span');
    parent.append(island, next);
    document.body.append(parent);
    for (const el of [parent, next]) el.getClientRects = () => [{}] as any;
    rect(parent, 0, 500);
    rect(next, 104, 120);
  });

  afterEach(() => parent.remove());

  it('is not stuck in place', () => {
    rect(island, 70, 100);
    expect(isStuck(island)).toBe(false);
  });

  it('is stuck when shifted up or down from the next sibling', () => {
    rect(island, 50, 80);
    expect(isStuck(island)).toBe(true);
    rect(island, 90, 120);
    expect(isStuck(island)).toBe(true);
  });

  it('is not stuck when static', () => {
    island.style.position = 'static';
    rect(island, 50, 80);
    expect(isStuck(island)).toBe(false);
  });

  it('uses the end of the parent without a next sibling', () => {
    next.remove();
    parent.style.padding = '10px';
    rect(island, 460, 490);
    expect(isStuck(island)).toBe(false);
    rect(island, 300, 330);
    expect(isStuck(island)).toBe(true);
  });

  it('skips hidden siblings', () => {
    const hidden = document.createElement('span');
    hidden.getClientRects = () => [] as any;
    rect(hidden, 0, 0);
    island.after(hidden);
    rect(island, 70, 100);
    expect(isStuck(island)).toBe(false);
  });
});
