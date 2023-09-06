import { Directive, ElementRef, HostListener, Input, OnInit } from '@angular/core';
import { ConfigService } from '../service/config.service';
import { Dim, height, ImageDimService, width } from '../service/image-dim.service';

@Directive({
  selector: '[appImageDim]'
})
export class ImageDimDirective implements OnInit {
  @Input()
  grid = false;
  @Input('defaultWidth')
  defaultWidth?: number;
  @Input('defaultHeight')
  defaultHeight?: number;

  private dim: Dim = { width: 0, height: 0};

  resizeObserver?: ResizeObserver;

  constructor(
    private config: ConfigService,
    private elRef: ElementRef,
    private ids: ImageDimService,
  ) {
    this.el.style.backgroundImage = `url("./assets/image-loading.png")`;
  }

  ngOnInit() {
    if (this.config.mobile) {
      this.el.style.width = this.defaultWidthPx || '100vw';
      this.el.style.height = this.defaultHeightPx || '80vh';
      this.el.style.backgroundSize = 'cover';
    } else {
      this.el.style.width = this.defaultWidthPx || '600px';
      this.el.style.height = this.defaultHeightPx || '600px';
    }
    if (this.grid) {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.el);
    }
  }

  get el() {
    return this.elRef.nativeElement;
  }

  get defaultWidthPx() {
    if (!this.defaultWidth) return undefined;
    if (this.config.mobile && this.defaultWidth > window.innerWidth) return '100vw'
    return this.defaultWidth + 'px'
  }

  get defaultHeightPx() {
    if (!this.defaultHeight) return undefined;
    return this.defaultHeight + 'px'
  }

  @Input('appImageDim')
  set url(value: string) {
    this.el.style.backgroundImage = `url('${value}')`;
    this.el.style.backgroundSize = 'contain';
    this.ids.getImageDim(value)
      .then((d: Dim) => {
        this.dim = d;
        this.onResize();
      });
  }

  private onResize() {
    if (this.defaultWidth && this.defaultHeight) {
      this.el.style.backgroundSize = '100% 100%';
      return;
    }
    const parentWidth = this.el.parentElement.offsetWidth;
    if (!this.grid && this.config.mobile && (!this.defaultWidth || this.defaultWidth >= window.innerWidth)) {
      this.el.style.width = parentWidth + 'px';
      this.el.style.height = this.defaultHeightPx || height(parentWidth, this.dim) + 'px';
    } else if (this.grid || this.dim.width > parentWidth && (!this.defaultWidth || this.defaultWidth >= parentWidth)) {
      this.el.style.width = '100%';
      this.el.style.height = this.defaultHeightPx || height(this.defaultWidth || parentWidth, this.dim) + 'px';
    } else if (this.defaultWidth) {
      this.el.style.width = this.defaultWidthPx;
      this.el.style.height = this.defaultHeightPx || height(this.defaultWidth, this.dim) + 'px';
    } else if (this.defaultHeight) {
      this.el.style.width = width(this.defaultHeight, this.dim) + 'px';
      this.el.style.height = this.defaultHeightPx;
    } else {
      this.el.style.width = this.dim.width + 'px';
      this.el.style.height = this.dim.height + 'px';
    }
  }
}
