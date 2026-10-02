import { AfterViewInit, Directive, effect, ElementRef, input, OnDestroy } from '@angular/core';
import { throttle } from 'lodash-es';
import { ConfigService } from '../service/config.service';

@Directive({
  selector: '[appLimitWidth]',
  host: {
    '(window:resize)': 'onWindowResize($event)',
  },
})
export class LimitWidthDirective implements OnDestroy, AfterViewInit {

  resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.fill()) || undefined;

  readonly limitSibling = input(false);

  readonly linked = input<HTMLElement | undefined | null>(undefined, { alias: 'appLimitWidth' });

  constructor(
    private config: ConfigService,
    private el: ElementRef,
  ) {
    effect(() => {
      const linked = this.linked();
      if (linked) this.resizeObserver?.observe(linked);
      this.fill();
    });
  }

  ngAfterViewInit() {
    this.fill();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  onWindowResize(event: UIEvent) {
    this.fill();
  }

  get max() {
    return window.innerWidth;
  }

  private fill = throttle(() => {
    const linked = this.linked();
    let linkedWidth = linked?.clientWidth || 0;
    if (this.limitSibling()) linkedWidth += linked?.nextElementSibling?.clientWidth || 0;
    if (this.config.mobile) {
      this.el.nativeElement.style.maxWidth = '100vw';
    } else if (!linkedWidth) {
      this.el.nativeElement.style.maxWidth = '';
    } else {
      this.el.nativeElement.style.maxWidth = Math.min(this.max, linkedWidth) + 'px';
    }
  }, 16, { leading: true, trailing: true});
}
