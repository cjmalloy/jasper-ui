import { AfterViewInit, Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { throttle } from 'lodash-es';
import { mobileWidth } from './fill-width.directive';

@Directive({
  selector: '[appLimitWidth]'
})
export class LimitWidthDirective implements OnDestroy, AfterViewInit {

  resizeObserver = new ResizeObserver(() => this.fill());

  private _linked?: HTMLElement;

  constructor(
    private el: ElementRef,
  ) { }

  get linked() {
    return this._linked;
  }

  @Input('appLimitWidth')
  set linked(value: HTMLElement | undefined) {
    this._linked = value;
    if (value) this.resizeObserver.observe(value);
  }

  ngAfterViewInit() {
    this.fill();
  }

  ngOnDestroy() {
    this.resizeObserver.disconnect();
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: UIEvent) {
    this.fill();
  }

  get max() {
    return window.innerWidth;
  }

  private fill = throttle(() => {
    const linkedWidth = this._linked?.clientWidth;
    if (window.innerWidth <= mobileWidth || !linkedWidth) {
      this.el.nativeElement.style.maxWidth = '';
    } else {
      this.el.nativeElement.style.maxWidth = Math.min(this.max, linkedWidth) + 'px';
    }
  }, 16, { leading: true, trailing: true});
}
