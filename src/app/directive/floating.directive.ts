import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked
} from '@angular/core';

const px = (value: string) => parseFloat(value) || 0;

function nextInFlow(el: Element) {
  for (let next = el.nextElementSibling; next; next = next.nextElementSibling) {
    if (!next.getClientRects().length) continue;
    const position = getComputedStyle(next).position;
    if (position === 'absolute' || position === 'fixed') continue;
    return next;
  }
  return undefined;
}

/**
 * Whether a sticky element is shifted from its place in flow. Compares the
 * element with the next in-flow sibling (or the end of its parent), which
 * scrolls normally. This avoids viewport geometry, since iOS sticks to a
 * different viewport than IntersectionObserver uses once the toolbar collapses.
 */
export function isStuck(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.position !== 'sticky') return false;
  const parent = el.parentElement;
  if (!parent) return false;
  const parentStyle = getComputedStyle(parent);
  const display = parentStyle.display;
  const block = !display.includes('grid') && !display.includes('flex');
  const bottom = el.getBoundingClientRect().bottom;
  const next = nextInFlow(el);
  let min: number, max: number;
  if (next) {
    const top = next.getBoundingClientRect().top;
    const mb = px(style.marginBottom);
    const mt = px(getComputedStyle(next).marginTop);
    // Margins may collapse in block layout
    max = top - (block ? Math.max(mb, mt) : mb + mt + px(parentStyle.rowGap));
    min = block ? top - mb - mt : max;
  } else {
    const r = parent.getBoundingClientRect();
    const end = r.bottom - px(parentStyle.borderBottomWidth) - px(parentStyle.paddingBottom);
    min = end - px(style.marginBottom);
    // The bottom margin may collapse through the parent in block layout
    max = block ? end : min;
  }
  return bottom < min - 1 || bottom > max + 1;
}

/**
 * Fallback for browsers without `scroll-state` container queries (Safari).
 * Adds the `stuck` class while the sticky `.buttons.floating` island is stuck
 * to the edge of the viewport. Use `[floating]="expr"` when the island is
 * toggled at runtime, since a `[class.floating]` binding cannot instantiate
 * a directive.
 */
@Directive({
  selector: '.buttons.floating, .buttons[floating]',
  host: {
    '[class.floating]': 'floating()',
    '[class.stuck]': 'stuck()',
  },
})
export class FloatingDirective {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  readonly floating = input(true, { transform: booleanAttribute });

  private readonly shifted = signal(false);
  readonly stuck = computed(() => this.floating() && this.shifted());

  private schedule?: () => void;

  constructor() {
    effect(() => {
      this.floating();
      untracked(() => this.schedule?.());
    });
    afterNextRender(() => {
      if (typeof CSS !== 'undefined' && CSS.supports?.('container-type', 'scroll-state')) return;
      const el = this.el.nativeElement;
      let frame = 0;
      const check = () => {
        frame = 0;
        this.shifted.set(isStuck(el));
      };
      const schedule = this.schedule = () => frame ||= requestAnimationFrame(check);
      const options = { capture: true, passive: true };
      document.addEventListener('scroll', schedule, options);
      window.addEventListener('resize', schedule, options);
      const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
      resize?.observe(el);
      if (el.parentElement) resize?.observe(el.parentElement);
      check();
      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        document.removeEventListener('scroll', schedule, options);
        window.removeEventListener('resize', schedule, options);
        resize?.disconnect();
      });
    });
  }
}
