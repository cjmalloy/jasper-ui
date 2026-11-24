import { afterNextRender, computed, DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { defer } from 'lodash-es';
import { ConfigService } from '../service/config.service';
import { ResizeStart, resizeStart, resizeToPointer } from '../util/resize';

@Directive({
  selector: '[appResizeHandle]',
  host: {
    '[style.cursor]': 'cursor()',
    '[class.resize-dragging]': 'dragging()',
    '[class.resize-handle]': "enabled()",
    '[class.resized]': 'resized()',
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
  readonly resized = signal(false);

  readonly hitArea = input(24);
  /** Keeps the grip reachable, so the embed can't be collapsed. */
  readonly minSize = input(48);
  readonly appResizeHandle = input<boolean | string | undefined>(true);
  readonly child = input<HTMLElement | undefined>();
  readonly initChild = input(false);

  start?: ResizeStart;

  resizeObserver?: ResizeObserver;

  get resizeCursor() {
    return this.config.mobile() ? 'row-resize' : 'se-resize';
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
        child.style.width = this.el.nativeElement.style.width || (this.config.mobile() ? 'min(100%, 100vw - 16px)' : 'min(100%, 80vw)');
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
    this.el.nativeElement.style.width = this.followChild(child, 'width');
    // When not resizable, let the height follow the child so its margins still apply
    this.el.nativeElement.style.height = this.enabled() ? this.followChild(child, 'height') : '';
  }

  /**
   * Percentages on the child are relative to the container, so copying them
   * would shrink the child again and leave the handle outside it.
   * Move them to the container and let the child fill it instead.
   */
  private followChild(child: HTMLElement, prop: 'width' | 'height') {
    const size = child.style[prop];
    if (!size.includes('%')) return size;
    if (size === '100%') return this.el.nativeElement.style[prop];
    child.style[prop] = '100%';
    return size;
  }

  onPointerDown(event: PointerEvent) {
    if (!this.enabled()) return;
    if (event.button) return;
    if (this.hit(event)) {
      this.dragging.set(true);
      this.cursor.set('grabbing');
      this.start = resizeStart(this.el.nativeElement, event);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  onPointerMove(event: PointerEvent) {
    if (!this.enabled()) return;
    if (this.dragging() && this.start) {
      this.resized.set(true);
      // The host binding applies later, but styles gated on .resized must be gone before measuring
      this.el.nativeElement.classList.add('resized');
      // Mobile embeds take the full width, so only the height can change (see resizeCursor)
      resizeToPointer(this.el.nativeElement, this.start, event,
        this.config.mobile() ? undefined : width => this.setWidth(Math.max(this.minSize(), width) + 'px'),
        height => this.setHeight(Math.max(this.minSize(), height) + 'px'));
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
    const rect = this.el.nativeElement.getBoundingClientRect();
    const grip = this.config.mobile() && this.grip(rect);
    if (grip) {
      // Mobile draws a larger grip away from the corner (see .resize-handle:before), so hit test the grip itself
      const pad = this.hitArea() / 2;
      return event.clientX >= grip.left - pad && event.clientX <= grip.right + pad
        && event.clientY >= grip.top - pad && event.clientY <= grip.bottom + pad;
    }
    return rect.right - event.clientX + rect.bottom - event.clientY < this.hitArea();
  }

  private grip(rect: DOMRect) {
    const style = getComputedStyle(this.el.nativeElement, '::before');
    const width = parseFloat(style.width), height = parseFloat(style.height);
    const right = parseFloat(style.right), bottom = parseFloat(style.bottom);
    if (!width || !height || isNaN(right) || isNaN(bottom)) return undefined;
    return {
      left: rect.right - right - width,
      right: rect.right - right,
      top: rect.bottom - bottom - height,
      bottom: rect.bottom - bottom,
    };
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
