/// <reference types="vitest/globals" />
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FloatingDirective, isStuck } from './floating.directive';

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

@Component({
  template: `<div><span class="buttons" [floating]="preview()"></span><span></span></div>`,
  imports: [FloatingDirective],
})
class ToggleHostComponent {
  readonly preview = signal(false);
}

describe('FloatingDirective', () => {
  const frame = () => new Promise(r => requestAnimationFrame(r));

  beforeEach(() => vi.stubGlobal('CSS', { supports: () => false }));
  afterEach(() => vi.unstubAllGlobals());

  it('applies floating and stuck from a runtime [floating] binding', async () => {
    const fixture = TestBed.createComponent(ToggleHostComponent);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const island = fixture.nativeElement.querySelector('.buttons') as HTMLElement;
    const next = island.nextElementSibling as HTMLElement;
    island.getBoundingClientRect = () => ({ top: 50, bottom: 80 } as DOMRect);
    next.getBoundingClientRect = () => ({ top: 104, bottom: 120 } as DOMRect);
    next.getClientRects = () => [{}] as any;
    expect(island.classList).not.toContain('floating');

    island.style.position = 'sticky';
    fixture.componentInstance.preview.set(true);
    fixture.detectChanges();
    await frame();
    fixture.detectChanges();
    expect(island.classList).toContain('floating');
    expect(island.classList).toContain('stuck');

    fixture.componentInstance.preview.set(false);
    fixture.detectChanges();
    expect(island.classList).not.toContain('floating');
    expect(island.classList).not.toContain('stuck');
    fixture.destroy();
  });
});
