import { Directive, ElementRef, HostBinding, HostListener, Input } from '@angular/core';
import { relativeX, relativeY } from '../util/math';

@Directive({
  selector: '[appResizeHandle]'
})
export class ResizeHandleDirective {

  @HostBinding('class.resize-handle') get css() { return this.enabled };
  @HostBinding('style.cursor') cursor = 'auto';

  @Input()
  hitArea = 20;
  @Input()
  target?: HTMLElement;

  dragging = false;
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  lastWidth = 0;
  lastHeight = 0;

  private _enabled: boolean | '' = true;

  constructor(
    private ref: ElementRef,
  ) { }

  get el() {
    return this.target || this.ref.nativeElement;
  }

  @Input('appResizeHandle')
  set enabled(value: boolean | "") {
    this._enabled = value;
    if (!value) {
      this.el.style.width = 'auto';
      this.el.style.height = 'auto';
    } else if (this.lastWidth) {
      this.el.style.width = this.lastWidth + 'px';
      this.el.style.height = this.lastHeight + 'px';
    }
  }

  get enabled(): boolean | "" {
    return this._enabled;
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent) {
    if (this._enabled !== false && this.hit(event)) {
      this.dragging = true;
      this.x = event.clientX;
      this.y = event.clientY;
      this.width = this.el.offsetWidth;
      this.height = this.el.offsetHeight;
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
      this.lastWidth = this.width + dx;
      this.lastHeight = this.height + dy;
      this.el.style.width = this.lastWidth + 'px';
      this.el.style.height = this.lastHeight + 'px';
    } else {
      this.cursor = this.hit(event) ? 'se-resize' : 'auto';
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    this.dragging = false;
  }

  private hit(event: PointerEvent) {
    const x = relativeX(event.clientX, this.el);
    const y = relativeY(event.clientY, this.el);
    return x + this.hitArea > this.el.offsetWidth &&
           y + this.hitArea > this.el.offsetHeight;
  }

}
