import { Directive, ElementRef, HostBinding, HostListener, Input, NgZone } from '@angular/core';
import { ConfigService } from '../service/config.service';
import { relativeX, relativeY } from '../util/math';

@Directive({
  standalone: false,
  selector: '[appResizeHandle]'
})
export class ResizeHandleDirective {
  @HostBinding('class') css = 'resize-handle';
  @HostBinding('style.cursor') cursor = 'auto';

  @Input()
  hitArea = 24;

  dragging = false;
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  constructor(
    private config: ConfigService,
    private el: ElementRef,
    private zone: NgZone,
  ) { }

  get resizeCursor() {
    return this.config.mobile ? 'row-resize' : 'se-resize';
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
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
    if (this.dragging) {
      this.zone.run(() => {
        const dx = event.clientX - this.x;
        const dy = event.clientY - this.y;
        this.el.nativeElement.style.width = (this.width + dx) + 'px';
        this.el.nativeElement.style.height = (this.height + dy) + 'px';
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
    if (this.dragging) {
      this.dragging = false;
      this.cursor = this.hit(event) ? this.resizeCursor : 'auto';
    }
  }

  private hit(event: PointerEvent) {
    const x = this.el.nativeElement.offsetWidth - relativeX(event.clientX, this.el.nativeElement);
    const y = this.el.nativeElement.offsetHeight - relativeY(event.clientY, this.el.nativeElement);
    return x + y < this.hitArea;
  }

}
