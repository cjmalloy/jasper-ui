import { Component, ElementRef, HostBinding, HostListener, Input, ViewChild } from '@angular/core';
import Hls from 'hls.js';
import { defer, without } from 'lodash-es';
import { Ext } from '../../model/ext';
import { Oembed } from '../../model/oembed';
import { Page } from '../../model/page';
import { findExtension, Ref, RefSort } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { EmbedService } from '../../service/embed.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { hasComment } from '../../util/format';
import { UrlFilter } from '../../util/query';
import { hasTag } from '../../util/tag';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent {
  @HostBinding('class') css = 'embed print-images';
  @HostBinding('tabindex') tabIndex = 0;

  @Input()
  text? = '';
  @Input()
  tags?: string[];
  @Input()
  disableResize = false;

  repost?: Ref;
  page?: Page<Ref>;
  ext?: Ext;
  lensQuery = '';
  lensSize = 24;
  lensCols = 0;
  lensSort: RefSort[] = [];
  lensFilter: UrlFilter[] = [];
  lensSearch = '';
  image? : string;
  audioUrl = '';
  videoUrl = '';
  imageUrl = '';
  pdfUrl = '';
  qrUrl = '';
  uis = this.admin.getPluginUi(this.currentTags);
  embedReady = false;

  private _ref?: Ref;
  private _oembed?: Oembed;
  private _iframe!: ElementRef;

  constructor(
    public admin: AdminService,
    public scraper: ScrapeService,
    private config: ConfigService,
    private oembeds: OembedStore,
    private embeds: EmbedService,
    private editor: EditorService,
    private refs: RefService,
    private store: Store,
    public el: ElementRef,
  ) { }

  @HostListener('click')
  onClick() {
    this.el.nativeElement.focus();
  }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref | undefined) {
    this._ref = value;
    this.audioUrl = this.getAudioUrl();
    this.videoUrl = this.getVideoUrl();
    this.imageUrl = this.getImageUrl();
    this.pdfUrl = this.getPdfUrl();
    this.qrUrl = this.getQrUrl();
    this.uis = this.admin.getPluginUi(this.currentTags);
    if (hasTag('plugin/repost', this.ref)) {
      this.refs.get(value!.sources![0], value!.origin)
        .subscribe(ref => this.repost = ref);
    }
    if (hasTag('plugin/lens', this.ref)) {
      const queryUrl = value!.plugins?.['plugin/lens']?.url || value?.url;
      this.embeds.loadQuery$(queryUrl)
        .subscribe(({params, page, ext}) => {
          this.page = page;
          this.ext = ext;
          this.lensQuery = this.editor.getQuery(queryUrl);
          this.lensSize = params.size;
          this.lensCols = params.cols;
          this.lensSort = params.sort;
          this.lensFilter = params.filter;
          this.lensSearch = params.search;
        });
    }
    if (this.currentTags.includes('plugin/embed')) {
      let width = this.embed.width || (this.config.mobile ? (window.innerWidth - 12) : this.el.nativeElement.parentElement.offsetWidth - 400);
      let height = this.embed.height || window.innerHeight;
      if (hasTag('plugin/fullscreen', this.ref)) {
        width = screen.width;
        height = screen.height;
      }
      this.oembeds.get(value!.url, this.theme, width, height).subscribe(oembed => this.oembed = oembed);
    }
  }

  get iframe(): ElementRef {
    return this._iframe;
  }

  @ViewChild('video')
  set video(value: ElementRef<HTMLVideoElement>) {
    if (!value) return;
    const video = value.nativeElement;
    if (video.canPlayType('application/vnd.apple.mpegurl')) return;
    if (Hls.isSupported() && this.hls) {
      const hls = new Hls();
      hls.loadSource(this.videoUrl);
      hls.attachMedia(video);
    }
  }

  @ViewChild('iframe')
  set iframe(value: ElementRef) {
    this._iframe = value;
  }

  set oembed(oembed: Oembed | null) {
    if (!this._iframe) {
      defer(() => this.oembed = oembed);
      return;
    }
    this._oembed = oembed!;
    if (oembed) {
      if (oembed.url && oembed.type === 'photo') {
        // Image embed
        this.tags = without(this.currentTags, 'plugin/embed');
        this.image = oembed.url;
        this.imageUrl = this.getImageUrl();
      } else {
        this.embeds.writeIframe(oembed, this._iframe.nativeElement, this.embedWidth)
          .then(() => this.embedReady = true);
      }
    } else {
      this.embedReady = true;
      this._iframe.nativeElement.src = this.embed.url || this.ref?.url;
      this._iframe.nativeElement.style.width = this.embedWidth;
      this._iframe.nativeElement.style.height = this.embedHeight;
    }
  }

  get oembed() {
    return this._oembed!;
  }

  get hls() {
    return this.videoUrl.endsWith('.m3u8') || this.tags?.includes('plugin/hls');
  }

  get twitter() {
    return this.oembed?.provider_name === 'Twitter';
  }

  get currentText() {
    if (this.tags) return '';
    if (this.pdfUrl && !this.ref?.plugins?.['plugin/pdf']?.showAbstract) return '';
    const value = this.text || this.ref?.comment || '';
    if (this.ref?.title || this.text || hasTag('plugin/thread', this.ref) || hasComment(this.ref?.comment)) return value;
    return '';
  }

  get currentTags() {
    return this.tags || this.ref?.tags || [];
  }

  get embed() {
    if (!this.currentTags.includes('plugin/embed')) return undefined;
    return this.ref?.plugins?.['plugin/embed'];
  }

  get embedWidth() {
    if (this.embed?.width) return this.embed.width + 'px';
    if (this.config.mobile && window.matchMedia("(orientation: landscape)").matches) {
      return 'calc(100vw - 12px)';
    }
    return '80vw';
  }

  get embedHeight() {
    if (this.embed?.height) return this.embed.height + 'px';
    if (this.config.mobile && window.matchMedia("(orientation: landscape)").matches) {
      return '100vh';
    }
    return '67vh';
  }

  getAudioUrl() {
    if (!this.currentTags.includes('plugin/audio')) return '';
    const url = this.ref?.plugins?.['plugin/audio']?.url || this.ref?.url;
    if (!this.admin.status.plugins.audio?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }

  getVideoUrl() {
    if (!this.currentTags.includes('plugin/video')) return '';
    const url = this.ref?.plugins?.['plugin/video']?.url || this.ref?.url;
    if (!this.admin.status.plugins.video?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }

  getImageUrl() {
    if (!this.image && !this.currentTags.includes('plugin/image')) return '';
    const url = this.image || this.ref?.plugins?.['plugin/image']?.url || this.ref?.url;
    if (!this.admin.status.plugins.imagePlugin?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }

  getQrUrl() {
    if (!this.currentTags.includes('plugin/qr')) return '';
    return this.ref?.plugins?.['plugin/qr']?.url || this.ref?.url;
  }

  private get theme() {
    return this.store.darkTheme ? 'dark' : undefined;
  }

  get pdf() {
    if (!this.admin.status.plugins.pdf) return undefined;
    return this.ref?.plugins?.['plugin/pdf']?.url || findExtension('.pdf', this.ref);
  }

  getPdfUrl() {
    const url = this.pdf;
    if (!url) return url;
    if (!this.admin.status.plugins.pdf?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }
}
