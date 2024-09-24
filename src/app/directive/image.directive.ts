import { Directive, ElementRef, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { Ref } from '../model/ref';
import { ConfigService } from '../service/config.service';
import { Dim, height, ImageService, width } from '../service/image.service';
import { Store } from '../store/store';

@Directive({
  selector: '[appImage]'
})
export class ImageDirective implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @Input()
  grid = false;
  @Input()
  ref?: Ref;
  @Input('defaultWidth')
  defaultWidth?: number;
  @Input('defaultHeight')
  defaultHeight?: number;

  @HostBinding('class.loading')
  loading = true;

  private dim: Dim = { width: 0, height: 0};
  private resizeObserver?: ResizeObserver;
  private loadingUrl = '';

  constructor(
    private config: ConfigService,
    private store: Store,
    private elRef: ElementRef,
    private imgs: ImageService,
  ) {
    this.el.style.backgroundImage = `url("./assets/image-loading.png")`;
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'refresh') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          if (this.loading && this.loadingUrl) {
            this.url = this.loadingUrl;
          }
        }
      }
    }));
  }

  ngOnInit() {
    if (this.config.mobile) {
      this.el.style.width = this.defaultWidthPx || 'calc(100vw - 32px)';
      this.el.style.height = this.defaultHeightPx || '80vh';
    } else {
      this.el.style.width = this.defaultWidthPx || '600px';
      this.el.style.height = this.defaultHeightPx || '600px';
    }
    if (this.grid) {
      this.resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize());
      this.resizeObserver?.observe(this.el);
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.resizeObserver?.disconnect();
  }

  get el() {
    return this.elRef.nativeElement;
  }

  get parentWidth() {
    let parent = this.el.parentElement;
    while (parent && !parent.offsetWidth) parent = parent.parentElement;
    return parent?.offsetWidth || 0;
  }

  get defaultWidthPx() {
    if (!this.defaultWidth) return undefined;
    if (this.config.mobile && this.defaultWidth > window.innerWidth) return 'calc(100vw - 32px)'
    return this.defaultWidth + 'px'
  }

  get defaultHeightPx() {
    if (!this.defaultHeight) return undefined;
    return this.defaultHeight + 'px'
  }

  @Input('appImage')
  set url(value: string) {
    this.loading = true;
    this.loadingUrl = value;
    this.el.style.backgroundRepeat = 'no-repeat';
    this.el.style.backgroundPosition = 'center center';
    this.el.style.backgroundSize = 'unset';
    this.imgs.getImage(value)
      .then((dim: Dim) => {
        this.loading = false;
        this.el.style.backgroundImage = `url('${value}')`;
        this.el.style.backgroundSize = this.config.mobile ? 'cover' : 'contain';
        this.dim = dim;
        this.onResize();
      });
  }

  private onResize() {
    if (this.defaultWidth && this.defaultHeight) {
      this.el.style.width = this.defaultWidth + 'px';
      this.el.style.height = this.defaultHeight + 'px';
      this.el.style.backgroundSize = '100% 100%';
      return;
    }
    const parentWidth = this.parentWidth;
    if (this.config.mobile && !this.grid && (!this.defaultWidth || this.defaultWidth >= window.innerWidth)) {
      this.el.style.width = (parentWidth - 12) + 'px';
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
