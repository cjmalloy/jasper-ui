/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LongPressDirective } from './long-press.directive';

@Component({
  template: `<div appLongPress (appLongPress)="presses = presses + 1" (click)="clicks = clicks + 1"></div>`,
  imports: [LongPressDirective],
})
class HostComponent {
  presses = 0;
  clicks = 0;
}

describe('LongPressDirective', () => {
  let host: HostComponent;
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
    el = fixture.nativeElement.querySelector('div');
  });

  afterEach(() => vi.useRealTimers());

  function touch(type: string, x = 0, y = 0) {
    const e = new Event(type, { bubbles: true, cancelable: true }) as any;
    e.touches = type === 'touchend' ? [] : Object.assign([{ clientX: x, clientY: y }], { item: (i: number) => e.touches[i] });
    el.dispatchEvent(e);
    return e as Event;
  }

  it('emits on a held touch and cancels the click that ends it', () => {
    touch('touchstart');
    vi.advanceTimersByTime(500);
    expect(host.presses).toBe(1);
    expect(touch('touchend').defaultPrevented).toBe(true);
    el.click();
    expect(host.clicks).toBe(0);
    el.click();
    expect(host.clicks).toBe(1);
  });

  it('does not emit when the touch moves to scroll or ends early', () => {
    touch('touchstart');
    touch('touchmove', 0, 30);
    vi.advanceTimersByTime(600);
    touch('touchstart');
    vi.advanceTimersByTime(200);
    expect(touch('touchend').defaultPrevented).toBe(false);
    vi.advanceTimersByTime(600);
    expect(host.presses).toBe(0);
  });

  it('emits once when contextmenu follows a long press', () => {
    touch('touchstart');
    vi.advanceTimersByTime(500);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(host.presses).toBe(1);
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(host.presses).toBe(2);
  });
});
