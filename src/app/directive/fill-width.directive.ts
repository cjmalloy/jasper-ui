import { Directive, ElementRef, input, afterNextRender, DestroyRef, inject } from '@angular/core';
import { throttle } from 'lodash-es';
import { ConfigService } from '../service/config.service';

@Directive({
  selector: '[appFillWidth]',
  host: {
    '(window:resize)': 'onWindowResize($event)',
    '(pointerdown)': 'onWindowPointerDown($event)',
    '(pointerup)': 'onWindowPointerUp($event)',
  },
})
export class FillWidthDirective {
  private config = inject(ConfigService);
  private el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);


  readonly parent = input<HTMLElement | undefined>(undefined, { alias: 'appFillWidth' });

  readonly padding = input(4);

  resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  dragging = false;

  constructor() {
    const el = this.el;

    this.resizeObserver?.observe(el.nativeElement);
  }

  private readonly initializeView = afterNextRender(() => {
    this.onResize();
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.resizeObserver?.disconnect();
  });

  onWindowResize(event: UIEvent) {
    this.onResize();
  }

  onWindowPointerDown(event: PointerEvent) {
    this.dragging = true;
  }

  onWindowPointerUp(event: PointerEvent) {
    this.dragging = false;
  }

  get max() {
    const left = this.el.nativeElement.getBoundingClientRect().left;
    return window.innerWidth - left;
  }

  private onResize = throttle(() => {
    if (this.config.mobile) {
      if (this.el.nativeElement.style.minWidth) {
        this.el.nativeElement.style.minWidth = '';
      }
      if (this.el.nativeElement.style.width) {
        this.el.nativeElement.style.width = '';
      }
    } else if (this.dragging) {
      this.el.nativeElement.style.minWidth = '504px';
    } else {
      const parentWidth = this.parent()?.clientWidth || 0;
      if (this.el.nativeElement.offsetWidth < parentWidth) {
        this.el.nativeElement.style.minWidth = Math.min(this.max, parentWidth - this.padding() * 2) - 8 + 'px';
      }
    }
  }, 16, { leading: true, trailing: true });
}
