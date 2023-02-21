import { Directive, ElementRef, HostBinding, HostListener, Input } from '@angular/core';
import { relativeX, relativeY } from '../util/math';

@Directive({
  selector: '[appResizeHandle]'
})
export class ResizeHandleDirective {
  @HostBinding('class') css = 'resize-handle';
  @HostBinding('style.cursor') cursor = 'auto';

  @Input()
  hitArea = 20;

  dragging = false;
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  constructor(
    private el: ElementRef,
  ) { }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
    if (this.hit(event)) {
      this.dragging = true;
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
      this.cursor = 'se-resize';
      const dx = event.clientX - this.x;
      const dy = event.clientY - this.y;
      this.el.nativeElement.style.width = (this.width + dx) + 'px';
      this.el.nativeElement.style.height = (this.height + dy) + 'px';
    } else {
      this.cursor = this.hit(event) ? 'se-resize' : 'auto';
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    this.dragging = false;
  }

  private hit(event: PointerEvent) {
    const x = relativeX(event.clientX, this.el.nativeElement);
    const y = relativeY(event.clientY, this.el.nativeElement);
    return x + this.hitArea > this.el.nativeElement.offsetWidth &&
           y + this.hitArea > this.el.nativeElement.offsetHeight;
  }

}
