import { AfterViewInit, Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { debounce } from 'lodash-es';

@Directive({
  selector: '[appLimitWidth]'
})
export class LimitWidthDirective implements OnDestroy, AfterViewInit {

  private _linked?: HTMLTextAreaElement;

  @Input()
  padding = 0;

  resizeObserver = new ResizeObserver(() => this.fill());

  constructor(
    private el: ElementRef,
  ) {
  }

  get linked() {
    return this._linked;
  }

  @Input('appLimitWidth')
  set linked(value: HTMLTextAreaElement | undefined) {
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

  private fill = debounce(() => {
    const parentWidth = this._linked?.clientWidth;
    if (parentWidth) {
      this.el.nativeElement.style.maxWidth = parentWidth - this.padding + 'px';
    }
  }, 5);
}
