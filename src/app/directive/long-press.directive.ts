import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/**
 * Emits on a touch long press, or on contextmenu.
 * iOS Safari does not send contextmenu for a long press, so time the touch instead.
 * The click that ends a long press is cancelled.
 */
@Directive({
  selector: '[appLongPress]',
  host: {
    '(contextmenu)': 'onContextmenu($event)',
  },
})
export class LongPressDirective {
  private el = inject(ElementRef);

  readonly delay = input(500, { alias: 'longPressDelay' });
  readonly longPress = output<Event>({ alias: 'appLongPress' });

  private timer?: number;
  private start?: { x: number, y: number };
  private pressed = false;

  private readonly onTouchstart = (e: TouchEvent) => {
    this.clear();
    this.pressed = false;
    if (e.touches.length !== 1) return;
    const t = e.touches.item(0)!;
    this.start = { x: t.clientX, y: t.clientY };
    this.timer = window.setTimeout(() => {
      delete this.timer;
      this.pressed = true;
      this.longPress.emit(e);
    }, this.delay());
  };

  private readonly onTouchmove = (e: TouchEvent) => {
    if (!this.timer || !this.start) return;
    const t = e.touches.item(0)!;
    if (e.touches.length !== 1 || Math.abs(t.clientX - this.start.x) > 10 || Math.abs(t.clientY - this.start.y) > 10) {
      this.clear();
    }
  };

  private readonly onTouchend = (e: TouchEvent) => {
    this.clear();
    // Cancel the click so a long press does not also tap
    if (this.pressed && e.cancelable) e.preventDefault();
  };

  private readonly onClick = (e: MouseEvent) => {
    if (!this.pressed) return;
    this.pressed = false;
    e.preventDefault();
    e.stopPropagation();
  };

  private readonly listeners: [string, (e: any) => void, AddEventListenerOptions][] = [
    ['touchstart', this.onTouchstart, { passive: true }],
    ['touchmove', this.onTouchmove, { passive: true }],
    ['touchend', this.onTouchend, { passive: false }],
    ['touchcancel', () => this.clear(), { passive: true }],
    ['click', this.onClick, { capture: true }],
  ];

  constructor() {
    // Listen outside of Angular so touches do not schedule change detection
    for (const [type, fn, options] of this.listeners) this.el.nativeElement.addEventListener(type, fn, options);
    inject(DestroyRef).onDestroy(() => {
      this.clear();
      for (const [type, fn, options] of this.listeners) this.el.nativeElement.removeEventListener(type, fn, options);
    });
  }

  onContextmenu(e: Event) {
    if (this.pressed) {
      // Android sends contextmenu after a long press too
      this.pressed = false;
      e.preventDefault();
      return;
    }
    this.clear();
    this.longPress.emit(e);
  }

  private clear() {
    if (this.timer) window.clearTimeout(this.timer);
    delete this.timer;
  }
}
