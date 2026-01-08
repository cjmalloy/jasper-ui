import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnDestroy
} from '@angular/core';
import { ConfigService } from '../service/config.service';
import { relativeX, relativeY } from '../util/math';

@Directive({
    selector: '[appResizeHandle]',
})
export class ResizeHandleDirective implements AfterViewInit, OnDestroy {
  @HostBinding('style.cursor') cursor = 'auto';

  @Input()
  hitArea = 24;

  @Input()
  @HostBinding('class.resize-handle')
  appResizeHandle?: boolean | string = true;

  @Input()
  child?: HTMLElement;

  dragging = false;
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  resizeObserver?: ResizeObserver;

  constructor(
    private config: ConfigService,
    private el: ElementRef,
    private zone: NgZone,
  ) { }

  get resizeCursor() {
    return this.config.mobile ? 'row-resize' : 'se-resize';
  }

  ngAfterViewInit() {
    if (!this.appResizeHandle) return;
    this.resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.shrinkContainer()) || undefined;
    if (this.child) this.resizeObserver?.observe(this.child);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  shrinkContainer() {
    if (!this.child) return;
    this.el.nativeElement.style.width = this.child.style.width;
    this.el.nativeElement.style.height = this.child.style.height;
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
    if (!this.appResizeHandle) return;
    if (event.button) return;
    if (this.hit(event)) {
      this.dragging = true;
      this.cursor = 'grabbing';
      this.x = event.clientX;
      this.y = event.clientY;
      this.width = this.el.nativeElement.offsetWidth;
      this.height = this.el.nativeElement.offsetHeight;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent) {
    if (!this.appResizeHandle) return;
    if (this.dragging) {
      this.zone.run(() => {
        const dx = event.clientX - this.x;
        const dy = event.clientY - this.y;
        this.setWidth((this.width + dx) + 'px');
        this.setHeight((this.height + dy) + 'px');
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      });
    } else {
      const cursor = this.hit(event) ? this.resizeCursor : 'auto';
      if (this.cursor !== cursor) {
        this.zone.run(() => this.cursor = cursor);
      }
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    if (!this.appResizeHandle) return;
    if (this.dragging) {
      this.dragging = false;
      this.cursor = this.hit(event) ? this.resizeCursor : 'auto';
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  private hit(event: PointerEvent) {
    const x = this.el.nativeElement.offsetWidth - relativeX(event.clientX, this.el.nativeElement);
    const y = this.el.nativeElement.offsetHeight - relativeY(event.clientY, this.el.nativeElement);
    return x + y < this.hitArea;
  }

  private setWidth(width: string) {
    this.el.nativeElement.style.width = width;
    if (this.child) this.child.style.width = width;
  }

  private setHeight(height: string) {
    this.el.nativeElement.style.height = height;
    if (this.child) this.child.style.height = height;
  }

}
