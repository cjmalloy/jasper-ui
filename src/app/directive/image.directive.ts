import { computed, Directive, effect, ElementRef, input, signal, untracked, afterNextRender, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Ref } from '../model/ref';
import { ConfigService } from '../service/config.service';
import { Dim, height, ImageService, width } from '../service/image.service';
import { Store } from '../store/store';

@Directive({
  selector: '[appImage]',
  host: {
    '[class.loading]': 'loading()',
  },
})
export class ImageDirective {
  private config = inject(ConfigService);
  private store = inject(Store);
  private elRef = inject(ElementRef);
  private imgs = inject(ImageService);

  readonly grid = input(false);
  readonly padding = input(8);
  readonly ref = input<Ref | undefined>();
  readonly defaultWidth = input<number | undefined>(undefined, { alias: 'defaultWidth' });
  readonly defaultHeight = input<number | undefined>(undefined, { alias: 'defaultHeight' });
  readonly url = input('', { alias: 'appImage' });

  readonly loading = signal(true);

  private dim: Dim = { width: 0, height: 0 };
  private resizeObserver?: ResizeObserver;
  private loadingUrl = '';

  constructor() {
    this.store.eventBus.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.event === 'refresh') {
        const ref = this.ref();
        if (ref?.url && this.store.eventBus.isRef(event, ref)) {
          if (this.loading() && this.loadingUrl) {
            this.loadUrl(this.loadingUrl);
          }
        }
      }
    });
    effect(() => {
      const value = this.url();
      untracked(() => this.loadUrl(value));
    });
  }

  private readonly initialize = afterNextRender(() => {
    if (this.grid()) {
      this.resizeObserver = window.ResizeObserver && new ResizeObserver(() => this.onResize());
      this.resizeObserver?.observe(this.el);
    } else {
      if (this.config.mobile()) {
        this.el.style.width = this.defaultWidthPx || null;
        this.el.style.height = this.defaultHeightPx() || this.el.clientWidth + 'px';
      } else {
        this.el.style.width = this.defaultWidthPx || '600px';
        this.el.style.height = this.defaultHeightPx() || '600px';
      }
    }
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.resizeObserver?.disconnect();
  });

  get el() {
    return this.elRef.nativeElement;
  }

  get parentWidth() {
    let parent = this.el.parentElement;
    while (parent && !parent.offsetWidth) parent = parent.parentElement;
    return parent?.offsetWidth || 0;
  }

  get defaultWidthPx() {
    const defaultWidth = this.defaultWidth();
    if (!defaultWidth) return undefined;
    if (this.config.mobile() && defaultWidth > window.innerWidth) return 'calc(100vw - 32px)'
    return defaultWidth + 'px'
  }

  readonly defaultHeightPx = computed(() => {
    const defaultHeight = this.defaultHeight();
    if (!defaultHeight) return undefined;
    return defaultHeight + 'px'
  });

  private loadUrl(value: string) {
    if (!value) return;
    this.loading.set(true);
    this.loadingUrl = value;
    this.el.style.backgroundRepeat = 'no-repeat';
    this.el.style.backgroundPosition = 'center center';
    this.el.style.backgroundSize = 'unset';
    this.imgs.getImage(value)
      .then((dim: Dim) => {
        this.loading.set(false);
        this.el.style.backgroundImage = `url('${value}')`;
        this.el.style.backgroundSize = this.config.mobile() ? 'cover' : 'contain';
        this.dim = dim;
        this.onResize();
      });
  }

  private onResize() {
    const defaultWidth = this.defaultWidth();
    const defaultHeight = this.defaultHeight();
    if (defaultWidth && defaultHeight) {
      this.el.style.width = defaultWidth + 'px';
      this.el.style.height = defaultHeight + 'px';
      this.el.style.backgroundSize = '100% 100%';
      return;
    }
    const grid = this.grid();
    const parentWidth = this.parentWidth - (grid ? 0 : this.padding());
    if (this.config.mobile() && !grid && (!defaultWidth || defaultWidth >= window.innerWidth)) {
      this.el.style.width = parentWidth + 'px';
      this.el.style.height = this.defaultHeightPx() || height(parentWidth, this.dim) + 'px';
    } else if (grid || this.dim.width > parentWidth && (!defaultWidth || defaultWidth >= parentWidth)) {
      this.el.style.width = parentWidth + 'px';
      this.el.style.height = this.defaultHeightPx() || height(parentWidth, this.dim) + 'px';
    } else if (defaultWidth) {
      this.el.style.width = this.defaultWidthPx;
      this.el.style.height = this.defaultHeightPx() || height(defaultWidth, this.dim) + 'px';
    } else if (defaultHeight) {
      this.el.style.width = width(defaultHeight, this.dim) + 'px';
      this.el.style.height = this.defaultHeightPx();
    } else {
      this.el.style.width = this.dim.width + 'px';
      this.el.style.height = this.dim.height + 'px';
    }
  }
}
