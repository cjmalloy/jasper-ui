import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  ViewChild
} from '@angular/core';
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
export class ViewerComponent implements AfterViewInit {
  @HostBinding('class') css = 'embed print-images';
  @HostBinding('tabindex') tabIndex = 0;

  @Input()
  expand = true;
  @Input()
  text? = '';
  @Input()
  origin? = '';
  @Input()
  disableResize = false;
  @Output()
  comment = new EventEmitter<string>();
  @Output()
  copied = new EventEmitter<string>();

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
  todo = false;
  chess = false;
  chessWhite = true;
  uis = this.admin.getPluginUi(this.currentTags);
  embedReady = false;

  private _ref?: Ref;
  private _tags?: string[];
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

  async ngAfterViewInit() {
    if (this.currentTags.includes('plugin/pip')) {
      // @ts-ignore
      const pipWindow = await documentPictureInPicture.requestWindow();
      pipWindow.document.body.append(this.el.nativeElement);
    }
  }

  init() {
    this.audioUrl = this.getAudioUrl();
    this.videoUrl = this.getVideoUrl();
    this.imageUrl = this.getImageUrl();
    this.pdfUrl = this.getPdfUrl();
    this.qrUrl = this.getQrUrl();
    this.todo = !!this.admin.getPlugin('plugin/todo') && this.currentTags.includes('plugin/todo');
    this.chess = !!this.admin.getPlugin('plugin/chess') && this.currentTags.includes('plugin/chess');
    this.chessWhite = !!this.ref?.tags?.includes(this.store.account.localTag);
    this.uis = this.admin.getPluginUi(this.currentTags);
    if (this.ref && hasTag('plugin/repost', this.ref)) {
      this.refs.get(this.ref.sources![0], this.ref.origin)
        .subscribe(ref => this.repost = ref);
    }
    const queryUrl = this.ref?.plugins?.['plugin/lens']?.url || this.ref?.url;
    if (queryUrl && hasTag('plugin/lens', this.ref)) {
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
    if (this.ref?.url && this.currentTags.includes('plugin/embed')) {
      let width = this.embed?.width || (this.config.mobile ? (window.innerWidth - 12) : this.el.nativeElement.parentElement.offsetWidth - 400);
      let height = this.embed?.height || window.innerHeight;
      if (hasTag('plugin/fullscreen', this.ref)) {
        width = screen.width;
        height = screen.height;
      }
      this.oembeds.get(this.ref.url, this.theme, width, height).subscribe(oembed => this.oembed = oembed);
    }
  }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref | undefined) {
    this._ref = value;
    this.init();
  }

  get tags() {
    return this._tags;
  }

  @Input()
  set tags(value: string[] | undefined) {
    this._tags = value;
    this.init();
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

  get hideComment() {
    if (this.admin.getPlugin('plugin/table') && this.currentTags.includes('plugin/table')) return false;
    return !!this.tags
      || this.chess
      || this.todo
      || (this.pdfUrl && !this.ref?.plugins?.['plugin/pdf']?.showAbstract);
  }

  get currentText() {
    if (this.hideComment) return '';
    const value = this.text || this.ref?.comment || '';
    if (this.ref?.title || this.text || hasTag('plugin/comment', this.ref) || hasTag('plugin/thread', this.ref) || hasComment(this.ref?.comment)) return value;
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
    if (!this.admin.getPlugin('plugin/audio')?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }

  getVideoUrl() {
    if (!this.currentTags.includes('plugin/video')) return '';
    const url = this.ref?.plugins?.['plugin/video']?.url || this.ref?.url;
    if (!this.admin.getPlugin('plugin/video')?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }

  getImageUrl() {
    if (!this.image && !this.currentTags.includes('plugin/image')) return '';
    const url = this.image || this.ref?.plugins?.['plugin/image']?.url || this.ref?.url;
    if (!this.admin.getPlugin('plugin/image')?.config?.cache) return url;
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
    if (!this.admin.getPlugin('plugin/pdf')) return undefined;
    return this.ref?.plugins?.['plugin/pdf']?.url || findExtension('.pdf', this.ref);
  }

  getPdfUrl() {
    const url = this.pdf;
    if (!url) return url;
    if (!this.admin.getPlugin('plugin/pdf')?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }
}
