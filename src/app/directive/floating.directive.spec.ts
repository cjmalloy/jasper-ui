/// <reference types="vitest/globals" />
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FloatingDirective } from './floating.directive';

@Component({
  template: `
    <span class="buttons floating" style="position: sticky; bottom: 8px"></span>
    <span class="buttons top" style="position: sticky; top: 8px" [class.floating]="preview()" [appFloating]="preview()"></span>
  `,
  imports: [FloatingDirective],
})
class HostComponent {
  preview = signal(true);
}

class MockObserver {
  static instances: MockObserver[] = [];
  observed: Element[] = [];
  observeCount = 0;
  disconnected = false;
  constructor(public callback: IntersectionObserverCallback, public options: IntersectionObserverInit) {
    MockObserver.instances.push(this);
  }
  observe(el: Element) { this.observed.push(el); this.observeCount++; }
  unobserve(el: Element) { this.observed = this.observed.filter(e => e !== el); }
  disconnect() { this.disconnected = true; }
}

const rootBounds = { top: 9, bottom: 591 } as DOMRectReadOnly;

function entry(target: Element, top: number, bottom: number, intersectionRatio: number) {
  return { target, rootBounds, intersectionRatio, boundingClientRect: { top, bottom } } as unknown as IntersectionObserverEntry;
}

describe('FloatingDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  function setup(scrollState = false) {
    MockObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockObserver);
    vi.stubGlobal('CSS', { supports: () => scrollState });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    TestBed.tick();
  }

  function el(i: number) {
    return fixture.nativeElement.querySelectorAll('span')[i] as HTMLElement;
  }

  function fire(i: number, ...e: IntersectionObserverEntry[]) {
    MockObserver.instances[i].callback(e, MockObserver.instances[i] as any);
    fixture.detectChanges();
  }

  afterEach(() => vi.unstubAllGlobals());

  it('toggles stuck at the bottom edge', () => {
    setup();
    fire(0, entry(el(0), 560, 592, 0.97));
    expect(el(0).classList).toContain('stuck');
    fire(0, entry(el(0), 300, 330, 1));
    expect(el(0).classList).not.toContain('stuck');
  });

  it('toggles stuck at the top edge', () => {
    setup();
    fire(1, entry(el(1), 8, 40, 0.97));
    expect(el(1).classList).toContain('stuck');
    fire(1, entry(el(1), 100, 130, 1));
    expect(el(1).classList).not.toContain('stuck');
  });

  it('ignores horizontal clipping', () => {
    setup();
    expect(MockObserver.instances[0].options.rootMargin).toMatch(/^-9px \d{5,}px -9px \d{5,}px$/);
  });

  it('re-observes and clears stuck when appFloating changes', () => {
    setup();
    fire(1, entry(el(1), 8, 40, 0.97));
    const before = MockObserver.instances[1].observeCount;
    fixture.componentInstance.preview.set(false);
    fixture.detectChanges();
    TestBed.tick();
    expect(MockObserver.instances[1].observeCount).toBeGreaterThan(before);
    expect(MockObserver.instances[1].observed).toEqual([el(1)]);
    el(1).style.position = 'static';
    fire(1, entry(el(1), 8, 40, 0.97));
    expect(el(1).classList).not.toContain('stuck');
  });

  it('does nothing when scroll-state is supported', () => {
    setup(true);
    expect(MockObserver.instances.length).toBe(0);
  });

  it('disconnects on destroy', () => {
    setup();
    fixture.destroy();
    expect(MockObserver.instances.every(o => o.disconnected)).toBe(true);
  });
});
