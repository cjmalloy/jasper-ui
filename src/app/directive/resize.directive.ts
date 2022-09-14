import { Directive, ElementRef, HostBinding, HostListener } from '@angular/core';

@Directive({
  selector: '[appResize]'
})
export class ResizeDirective {

  @HostBinding('style.width')
  get width() {
    return this.dim ? this.dim.x + 'px' : null;
  };

  @HostBinding('style.height')
  get height() {
    return this.dim ? this.dim.y + 'px' : null;
  };

  minPx = 2;

  zoom = 1;
  dim?: {x: number, y: number};
  oldZoom = 1;
  dragStart?: {x: number, y: number};
  startDim?: {x: number, y: number};
  dragging = false;
  wasDragging = false;

  constructor(private el: ElementRef) {}

  @HostListener('mousedown', ['$event'])
  mousedown(e: MouseEvent) {
    e.preventDefault();
    this.oldZoom = this.zoom;
    this.dragStart = {
      x: e.clientX,
      y: e.clientY,
    };
    this.startDim = {
      x: this.el.nativeElement.offsetWidth,
      y: this.el.nativeElement.offsetHeight,
    };
  }

  @HostListener('click', ['$event'])
  mouseup(e: MouseEvent) {
    if (this.wasDragging) {
      e.preventDefault();
    }
    this.wasDragging = false;
  }

  @HostListener('window:mousemove', ['$event'])
  windowMousemove(e: MouseEvent) {
    if (!this.dragStart || !this.startDim) return;
    if (!this.dragging) {
      if (Math.abs(e.clientX - this.dragStart.x) < this.minPx &&
          Math.abs(e.clientY - this.dragStart.y) < this.minPx) {
        return;
      }
      this.dragging = true;
      this.wasDragging = true;
    }
    e.preventDefault();
    const dx = (e.clientX - this.dragStart.x) / this.startDim.x;
    const dy = (e.clientY - this.dragStart.y) / this.startDim.y;
    const l = (dx + dy) / 2;
    this.dim ??= { ...this.startDim };
    this.dim.x = this.startDim.x * (1 + l);
    this.dim.y = this.startDim.y * (1 + l);
  }

  @HostListener('window:mouseup', ['$event'])
  windowMouseup(e: MouseEvent) {
    delete this.dragStart;
    if (this.dragging) {
      this.dragging = false;
      e.preventDefault();
    }
  }
}
