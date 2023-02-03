import { AfterViewInit, Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { throttle } from 'lodash-es';

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
  dragging = false;

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

  @HostListener('pointerdown', ['$event'])
  onWindowPointerDown(event: PointerEvent) {
    this.dragging = true;
  }

  @HostListener('pointerup', ['$event'])
  onWindowPointerUp(event: PointerEvent) {
    this.dragging = false;
  }

  get max() {
    const left = this.el.nativeElement.getBoundingClientRect().left;
    return window.innerWidth - left;
  }

  private fill = throttle(() => {
    if (window.innerWidth <= mobileWidth) {
      this.el.nativeElement.style.minWidth = '';
      this.el.nativeElement.style.width = this.max - 8 + 'px';
    } else if (this.dragging) {
      this.el.nativeElement.style.minWidth = '504px';
    } else {
      const parentWidth = this.parent?.clientWidth || 0;
      if (this.el.nativeElement.offsetWidth < parentWidth) {
        this.el.nativeElement.style.minWidth = Math.min(this.max, parentWidth) - this.padding + 'px';
      }
    }
  }, 16, { leading: true, trailing: true });
}
