import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * Fallback for browsers without `scroll-state` container queries (Safari).
 * Adds the `stuck` class while the sticky `.buttons.floating` island is stuck
 * to the edge of the viewport.
 */
@Directive({
  selector: '.buttons.floating',
  host: {
    '[class.stuck]': 'stuck()',
  },
})
export class FloatingDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  readonly stuck = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      if (typeof CSS !== 'undefined' && CSS.supports?.('container-type', 'scroll-state')) return;
      const el = this.el.nativeElement;
      // Sticky offset is 8px, so a stuck island pokes 1px into a 9px margin.
      // The wide horizontal margin keeps horizontal clipping from holding the
      // ratio below 1, which would suppress the callback that clears `stuck`.
      const observer = new IntersectionObserver(entries => {
        for (const e of entries) {
          const r = e.boundingClientRect;
          const rb = e.rootBounds;
          if (!rb) continue;
          const top = getComputedStyle(el).top !== 'auto';
          this.stuck.set(e.intersectionRatio < 1 && (top
            ? r.top < rb.top && r.bottom > rb.top
            : r.bottom > rb.bottom && r.top < rb.bottom));
        }
      }, { rootMargin: '-9px 100000px -9px 100000px', threshold: [0, 1] });
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
