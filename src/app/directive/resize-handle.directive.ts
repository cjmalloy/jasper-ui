import { computed, Directive, ElementRef, input, signal, afterNextRender, DestroyRef, inject } from '@angular/core';
import { defer } from 'lodash-es';
import { ConfigService } from '../service/config.service';
import { relativeX, relativeY } from '../util/math';

@Directive({
  selector: '[appResizeHandle]',
  host: {
    '[style.cursor]': 'cursor()',
    '[class.resize-dragging]': 'dragging()',
    '[class.resize-handle]': "enabled()",
    '(pointerdown)': 'onPointerDown($event)',
    '(window:pointermove)': 'onPointerMove($event)',
    '(window:pointerup)': 'onPointerUp($event)',
  },
})
export class ResizeHandleDirective {
  private config = inject(ConfigService);
  private el = inject(ElementRef);

  readonly cursor = signal('auto');
  readonly dragging = signal(false);

  readonly hitArea = input(24);
  readonly appResizeHandle = input<boolean | string | undefined>(true);
  readonly child = input<HTMLElement | undefined>();
  readonly initChild = input(false);

  x = 0;
  y = 0;
  width = 0;
  height = 0;

  resizeObserver?: ResizeObserver;

  get resizeCursor() {
    return this.config.mobile ? 'row-resize' : 'se-resize';
  }

  readonly enabled = computed(() => {
    return this.appResizeHandle() !== 'false' && this.appResizeHandle() !== false;
  });

  private readonly initializeView = afterNextRender(() => {
    if (!this.enabled()) return;
    this.resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.shrinkContainer()) || undefined;
    const child = this.child();
    if (child) {
      if (this.initChild()) {
        child.style.width = this.el.nativeElement.style.width || (this.config.mobile ? 'min(100%, 100vw - 16px)' : 'min(100%, 80vw)');
        child.style.height = this.el.nativeElement.style.height || '80vh';
      }
      this.resizeObserver?.observe(child);
    }
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.resizeObserver?.disconnect();
  });

  shrinkContainer() {
    const child = this.child();
    if (!child) return;
    this.el.nativeElement.style.width = child.style.width;
    this.el.nativeElement.style.height = child.style.height;
  }

  onPointerDown(event: PointerEvent) {
    if (!this.enabled()) return;
    if (event.button) return;
    if (this.hit(event)) {
      this.dragging.set(true);
      this.cursor.set('grabbing');
      this.x = event.clientX;
      this.y = event.clientY;
      this.width = this.el.nativeElement.offsetWidth;
      this.height = this.el.nativeElement.offsetHeight;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  onPointerMove(event: PointerEvent) {
    if (!this.enabled()) return;
    if (this.dragging()) {
      const dx = event.clientX - this.x;
      const dy = event.clientY - this.y;
      this.setWidth((this.width + dx) + 'px');
      this.setHeight((this.height + dy) + 'px');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    } else {
      const cursor = this.hit(event) ? this.resizeCursor : 'auto';
      if (this.cursor() !== cursor) {
        this.cursor.set(cursor);
      }
    }
  }

  onPointerUp(event: PointerEvent) {
    if (!this.enabled()) return;
    if (this.dragging()) {
      this.cursor.set(this.hit(event) ? this.resizeCursor : 'auto');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      defer(() => this.dragging.set(false));
    }
  }

  private hit(event: PointerEvent) {
    const x = this.el.nativeElement.offsetWidth - relativeX(event.clientX, this.el.nativeElement);
    const y = this.el.nativeElement.offsetHeight - relativeY(event.clientY, this.el.nativeElement);
    return x + y < this.hitArea();
  }

  private setWidth(width: string) {
    this.el.nativeElement.style.width = width;
    const child = this.child();
    if (child) child.style.width = width;
  }

  private setHeight(height: string) {
    this.el.nativeElement.style.height = height;
    const child = this.child();
    if (child) child.style.height = height;
  }

}
