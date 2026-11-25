import { afterNextRender, DestroyRef, Directive, effect, ElementRef, inject, input, signal, untracked } from '@angular/core';

/**
 * Fallback for browsers without `scroll-state` container queries (Safari).
 * Adds the `stuck` class while the sticky `.buttons.floating` island is stuck
 * to the edge of the viewport. Use `[appFloating]` when `.floating` is toggled
 * dynamically, since a class binding cannot instantiate a directive.
 */
@Directive({
  selector: '.buttons.floating, [appFloating]',
  host: {
    '[class.stuck]': 'stuck()',
  },
})
export class FloatingDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  readonly appFloating = input<boolean | ''>();

  readonly stuck = signal(false);

  private observer?: IntersectionObserver;

  constructor() {
    effect(() => {
      this.appFloating();
      // Re-observe to get a fresh entry once the island becomes sticky
      untracked(() => this.observe());
    });
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      if (typeof CSS !== 'undefined' && CSS.supports?.('container-type', 'scroll-state')) return;
      // Sticky offset is 8px, so a stuck island pokes 1px into a 9px margin.
      // The wide horizontal margin keeps horizontal clipping from holding the
      // ratio below 1, which would suppress the callback that clears `stuck`.
      this.observer = new IntersectionObserver(entries => this.update(entries), {
        rootMargin: '-9px 100000px -9px 100000px',
        threshold: [0, 1],
      });
      this.observe();
      this.destroyRef.onDestroy(() => this.observer?.disconnect());
    });
  }

  private observe() {
    if (!this.observer) return;
    this.observer.unobserve(this.el.nativeElement);
    this.observer.observe(this.el.nativeElement);
  }

  update(entries: IntersectionObserverEntry[]) {
    for (const e of entries) {
      const rb = e.rootBounds;
      if (!rb) continue;
      const style = getComputedStyle(this.el.nativeElement);
      if (style.position !== 'sticky') {
        this.stuck.set(false);
        continue;
      }
      const r = e.boundingClientRect;
      this.stuck.set(e.intersectionRatio < 1 && (style.top !== 'auto'
        ? r.top < rb.top && r.bottom > rb.top
        : r.bottom > rb.bottom && r.top < rb.bottom));
    }
  }
}
