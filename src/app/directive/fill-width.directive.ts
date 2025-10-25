import { AfterViewInit, Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { throttle } from 'lodash-es';
import { ConfigService } from '../service/config.service';

@Directive({ selector: '[appFillWidth]' })
export class FillWidthDirective implements OnDestroy, AfterViewInit {

  @Input('appFillWidth')
  parent?: HTMLElement;

  @Input()
  padding = 4;

  resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize()) || undefined;
  dragging = false;

  constructor(
    private config: ConfigService,
    private el: ElementRef<HTMLTextAreaElement>,
  ) {
    this.resizeObserver?.observe(el.nativeElement);
  }

  ngAfterViewInit() {
    this.onResize();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: UIEvent) {
    this.onResize();
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
      const parentWidth = this.parent?.clientWidth || 0;
      if (this.el.nativeElement.offsetWidth < parentWidth) {
        this.el.nativeElement.style.minWidth = Math.min(this.max, parentWidth - this.padding * 2) - 8 + 'px';
      }
    }
  }, 16, { leading: true, trailing: true });
}
