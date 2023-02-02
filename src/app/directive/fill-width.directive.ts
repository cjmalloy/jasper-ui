import { AfterViewInit, Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { debounce } from 'lodash-es';

export const mobileWidth = 640;

@Directive({
  selector: '[appFillWidth]'
})
export class FillWidthDirective implements OnDestroy, AfterViewInit {

  @Input('appFillWidth')
  parent?: HTMLElement;

  @Input()
  padding = 4;

  resizeObserver = new ResizeObserver(() => this.fill());

  constructor(
    private el: ElementRef<HTMLTextAreaElement>,
  ) {
    this.resizeObserver.observe(el.nativeElement);
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
    const left = this.el.nativeElement.getBoundingClientRect().left;
    return window.innerWidth - left;
  }

  private fill = debounce(() => {
    if (window.innerWidth <= mobileWidth) {
      this.el.nativeElement.style.minWidth = '';
      this.el.nativeElement.style.width = this.max - 8 + 'px';
    } else {
      const parentWidth = this.parent?.clientWidth || 0;
      if (this.el.nativeElement.offsetWidth < parentWidth) {
        this.el.nativeElement.style.minWidth = Math.min(this.max, parentWidth) - this.padding + 'px';
      }
    }
  }, 5);
}
