import { computed, DestroyRef, Directive, ElementRef, inject, input, output, signal } from '@angular/core';

@Directive({
  selector: '[appResize]',
  host: {
    '[style.z-index]': "zIndex()",
    '[class.resized]': 'dirty()',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '(mousedown)': 'onMousedown($event)',
    '(touchstart)': 'onTouchstart($event)',
    '(click)': 'onClick($event)',
  },
})
export class ResizeDirective {
  private el = inject(ElementRef);

  /**
   * Window listeners are only added while dragging. Non-passive touchmove listeners
   * on every image would block scrolling on touch screens.
   */
  private readonly windowListeners: [string, (e: any) => void, AddEventListenerOptions?][] = [
    ['mousemove', e => this.onMousemove(e)],
    ['touchmove', e => this.onTouchmove(e), { passive: false }],
    ['contextmenu', e => this.onCancel(e)],
    ['mouseup', e => this.onCancel(e)],
    ['touchend', e => this.onCancel(e)],
    ['touchcancel', e => this.onCancel(e)],
  ];
  private listening = false;
  private readonly destroy = inject(DestroyRef).onDestroy(() => this.unlisten());


  readonly enabled = input<boolean | undefined>(undefined, { alias: 'appResize' });
  /**
   * Clicks that did not end a resize drag.
   */
  readonly resizeClick = output<MouseEvent>({ alias: 'appResizeClick' });

  readonly zIndex = computed(() => {
    return this.dirty() ? 1 : 0;
  });

  readonly width = computed(() => {
    const dim = this.dim();
    if (!this.enabled() || !dim) return null;
    return dim.x + 'px';
  });

  readonly height = computed(() => {
    const dim = this.dim();
    if (!this.enabled() || !dim) return null;
    return dim.y + 'px';
  });

  minPx = 2;
  zoom = 1;
  readonly dim = signal<{x: number, y: number} | undefined>(undefined);
  oldZoom = 1;
  dragStart?: {x: number, y: number};
  startDim?: {x: number, y: number};
  dragging = false;
  wasDragging = false;
  readonly dirty = signal(false);

  onMousedown(e: MouseEvent) {
    if (this.enabled() === false) return;
    if (e.button) return;
    e.preventDefault();
    this.wasDragging = false;
    this.oldZoom = this.zoom;
    this.dragStart = {
      x: e.clientX,
      y: e.clientY,
    };
    this.startDim = {
      x: Math.floor(this.el.nativeElement.offsetWidth),
      y: Math.floor(this.el.nativeElement.offsetHeight),
    };
    this.listen();
  }

  onTouchstart(e: TouchEvent) {
    if (this.enabled() === false) return;
    if (e.touches.length === 1) this.wasDragging = false;
    if (e.touches.length != 2) return;
    if (window.visualViewport && window.visualViewport.scale > 1.01) return;
    e.preventDefault();
    this.oldZoom = this.zoom;
    const t1x = e.touches.item(0)!.clientX;
    const t1y = e.touches.item(0)!.clientY;
    const t2x = e.touches.item(1)?.clientX || 2 * t1x;
    const t2y = e.touches.item(1)?.clientY || 2 * t1y;
    this.dragStart = {
      x: Math.abs(t1x - t2x),
      y: Math.abs(t1y - t2y),
    };
    this.startDim = {
      x: Math.floor(this.el.nativeElement.offsetWidth),
      y: Math.floor(this.el.nativeElement.offsetHeight),
    };
    this.listen();
  }

  onClick(e: MouseEvent) {
    if (this.enabled() !== false && this.wasDragging) {
      e.preventDefault();
      this.wasDragging = false;
      return;
    }
    this.resizeClick.emit(e);
  }

  onMousemove(e: MouseEvent) {
    if (this.enabled() === false) return;
    if (!this.dragStart || !this.startDim) return;
    if (!this.dragging) {
      if (Math.abs(e.clientX - this.dragStart.x) < this.minPx &&
          Math.abs(e.clientY - this.dragStart.y) < this.minPx) {
        return;
      }
      this.dragging = true;
      this.wasDragging = true;
    }
    if (!this.dragStart || !this.startDim) return;
    e.preventDefault();
    const dx = (e.clientX - this.dragStart.x) / this.startDim.x;
    const dy = (e.clientY - this.dragStart.y) / this.startDim.y;
    const l = (dx + dy) / 2;
    const dim = { ...(this.dim() || this.startDim) };
    dim.x = Math.floor(this.startDim.x * (1 + l));
    dim.y = dim.x * this.startDim.y / this.startDim.x;
    this.dim.set(dim);
    this.dirty.set(true);
  }

  onTouchmove(e: TouchEvent) {
    if (this.enabled() === false) return;
    if (!this.dragStart || !this.startDim) return;
    if (!this.dragStart || !this.startDim) return;
    if (!this.dragging) {
      this.dragging = true;
      this.wasDragging = true;
    }
    e.preventDefault();
    const t1 = e.touches.item(0)!;
    const t2 = e.touches.item(1) || t1;
    const dims = {
      w: Math.abs(t1.clientX - t2.clientX),
      h: Math.abs(t1.clientY - t2.clientY),
    };
    const dx = (dims.w - this.dragStart.x) / this.startDim.x;
    const dy = (dims.h - this.dragStart.y) / this.startDim.y;
    const l = (dx + dy) / 2;
    const dim = { ...(this.dim() || this.startDim) };
    dim.x = Math.floor(this.startDim.x * (1 + l));
    dim.y = dim.x * this.startDim.y / this.startDim.x;
    this.dim.set(dim);
    this.dirty.set(true);
  }

  onCancel(e: Event) {
    this.unlisten();
    if (this.enabled() === false) return;
    delete this.dragStart;
    if (this.dragging) {
      this.dragging = false;
      e.preventDefault();
    }
  }

  private listen() {
    if (this.listening) return;
    this.listening = true;
    for (const [type, fn, options] of this.windowListeners) window.addEventListener(type, fn, options);
  }

  private unlisten() {
    if (!this.listening) return;
    this.listening = false;
    for (const [type, fn, options] of this.windowListeners) window.removeEventListener(type, fn, options);
  }

}
