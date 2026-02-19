import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostBinding,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormControl } from '@angular/forms';
import * as he from 'he';
import Hls from 'hls.js';
import { defer, isEqual, some, without } from 'lodash-es';
import { runInAction } from 'mobx';
import { BehaviorSubject, catchError, of, Subject, takeUntil, throwError } from 'rxjs';
import { ImageDirective } from '../../directive/image.directive';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ResizeDirective } from '../../directive/resize.directive';
import { Ext } from '../../model/ext';
import { Oembed } from '../../model/oembed';
import { Page } from '../../model/page';
import { getPluginScope, PluginApi } from '../../model/plugin';
import { Ref, RefSort, RefUpdates } from '../../model/ref';
import { EmitAction, hydrate } from '../../model/tag';
import { pdfUrl } from '../../mods/media/pdf';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { EmbedService } from '../../service/embed.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { embedUrl } from '../../util/embed';
import { hasComment, templates } from '../../util/format';
import { getExtension } from '../../util/http';
import { memo, MemoCache } from '../../util/memo';
import { UrlFilter } from '../../util/query';
import { hasPrefix, hasTag } from '../../util/tag';
import { BackgammonComponent } from '../backgammon/backgammon.component';
import { ChessComponent } from '../chess/chess.component';
import { LensComponent } from '../lens/lens.component';
import { LoadingComponent } from '../loading/loading.component';
import { MdComponent } from '../md/md.component';
import { ModComponent } from '../mod/mod.component';
import { PlaylistComponent } from '../playlist/playlist.component';
import { QrComponent } from '../qr/qr.component';
import { RefComponent } from '../ref/ref.component';
import { TodoComponent } from '../todo/todo.component';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
  imports: [
    forwardRef(() => RefComponent),
    forwardRef(() => PlaylistComponent),
    forwardRef(() => LensComponent),
    forwardRef(() => ModComponent),
    MdComponent,
    ImageDirective,
    ResizeDirective,
    QrComponent,
    TodoComponent,
    BackgammonComponent,
    ChessComponent,
    ResizeHandleDirective,
    LoadingComponent,
  ],
})
export class ViewerComponent implements OnChanges {
  @HostBinding('class') css = 'embed print-images';
  @HostBinding('tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();

  @ViewChild('iframe')
  iframe!: ElementRef;

  @Input()
  ref?: Ref;
  @Input()
  commentControl?: FormControl<string>;
  @Input()
  tags?: string[];
  @Input()
  expand = true;
  @Input()
  autoplay = false;
  @Input()
  text? = '';
  @Input()
  origin? = '';
  @Input()
  disableResize = false;
  @Input()
  @HostBinding('class.fullscreen')
  fullscreen = false;
  @Output()
  comment = new EventEmitter<string>();
  @Output()
  copied = new EventEmitter<string>();

  repost?: Ref;
  lens?: boolean;
  lensPage?: Page<Ref>;
  ext?: Ext;
  lensQuery = '';
  lensSize = 24;
  lensCols = 0;
  lensSort: RefSort[] = [];
  lensFilter: UrlFilter[] = [];
  lensSearch = '';
  image? : string;
  playlist = false;
  todo = false;
  backgammon = false;
  chess = false;
  chessWhite = true;
  uis = this.admin.getPluginUi(this.currentTags);
  embedReady = false;

  private _oembed?: Oembed;
  private width = 0;
  private height = 0;

  constructor(
    public config: ConfigService,
    public admin: AdminService,
    private proxy: ProxyService,
    private oembeds: OembedStore,
    private actions: ActionService,
    private embeds: EmbedService,
    private editor: EditorService,
    private refs: RefService,
    private store: Store,
    public el: ElementRef,
  ) { }

  init() {
    MemoCache.clear(this);
    this.playlist = !!this.admin.getPlugin('plugin/playlist') && hasTag('plugin/playlist', this.currentTags);
    this.todo = !!this.admin.getPlugin('plugin/todo') && hasTag('plugin/todo', this.currentTags);
    this.backgammon = !!this.admin.getPlugin('plugin/backgammon') && hasTag('plugin/backgammon', this.currentTags);
    this.chess = !!this.admin.getPlugin('plugin/chess') && hasTag('plugin/chess', this.currentTags);
    this.chessWhite = !!this.ref?.tags?.includes(this.store.account.localTag);
    this.uis = this.admin.getPluginUi(this.currentTags);
    if (this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref)) {
      this.refs.getCurrent(this.ref.sources[0]).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntil(this.destroy$),
      ).subscribe(ref => this.repost = ref);
    }
    const queryUrl = this.ref?.plugins?.['plugin/lens']?.url || (hasTag('plugin/repost', this.ref) ? this.ref?.sources?.[0] : this.ref?.url);
    if (queryUrl && hasTag('plugin/lens', this.ref)) {
      this.lens = true;
      this.embeds.loadQuery$(queryUrl)
        .pipe(takeUntil(this.destroy$))
        .subscribe(({params, page, ext}) => {
          this.lensPage = page;
          this.ext = ext;
          this.lensQuery = this.editor.getQuery(queryUrl);
          this.lensSize = params.size;
          this.lensCols = params.cols;
          this.lensSort = params.sort;
          this.lensFilter = params.filter;
          this.lensSearch = params.search;
        });
    }
    if (this.ref?.url && hasTag('plugin/embed', this.currentTags)) {
      this.width = this.embed?.width || (this.el.nativeElement.parentElement.offsetWidth - ((this.thread || !this.config.mobile) ? 32 : 12));
      this.height = this.embed?.height || window.innerHeight;
      if (hasTag('plugin/fullscreen', this.ref)) {
        this.width = screen.width;
        this.height = screen.height;
      }
      this.oembeds.get(this.ref.url, this.theme, this.width, this.height).subscribe(oembed => this.oembed = oembed);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const changesRef = changes.ref && changes.ref.currentValue?.modifiedString !== changes.ref.previousValue?.modifiedString;
    const changesTags = changes.tags && !isEqual(changes.tags.previousValue, changes.tags.currentValue);
    if (changesRef || changesTags || changes.text) {
      this.init();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostBinding('class')
  @memo
  get pluginClasses() {
    return this.css + ' ' + templates(this.tags, 'plugin')
      .map(t => t.replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  }

  @HostBinding('attr.title')
  @memo
  get title() {
    if (this.ref?.tags?.includes('plugin/alt') || this.tags?.includes('plugin/alt')) {
      return this.text || this.ref?.comment;
    }
    return undefined;
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

  @ViewChild('pdfIframe')
  set pdfIframe(value: ElementRef<HTMLIFrameElement>) {
    if (!value) return;
    const iframe = value.nativeElement;
    let url = this.pdfUrl;
    if (!url) return;
    if (url.startsWith('//')) url = location.protocol + url;
    this.embeds.writeIframeHtml(`<embed type="application/pdf" src="${he.encode(url)}" width="100%" height="100%">`, iframe, false);
    iframe.style.width = this.embedWidth;
    iframe.style.height = this.embedHeight;
  }

  set oembed(oembed: Oembed | null) {
    if (isEqual(this._oembed, oembed)) return;
    this._oembed = oembed || undefined;
    if (oembed?.url && oembed?.type === 'photo') {
      // Image embed
      this.tags = without(this.currentTags, 'plugin/embed');
      this.image = embedUrl(oembed.url);
      MemoCache.clear(this);
    } else if (this.iframe) {
      const i = this.iframe.nativeElement;
      if (oembed) {
        this.embeds.writeIframe(oembed, i, this.embedWidth, true)
          .then(() => {
            if (oembed.width! > this.width) {
              const s = this.width / oembed.width!;
              const marginLeft = oembed.width! - this.width;
              const marginTop = marginLeft * oembed.height! / oembed.width!;
              i.style.transform = `scale(${s}, ${s})`;
              i.style.transformOrigin = 'top left';
              i.style.marginRight = -1 * marginLeft + 'px';
              i.style.marginBottom = -1 * marginTop + 'px';
            }
            this.embedReady = true;
            MemoCache.clear(this);
          });
      } else {
        i.src = embedUrl(this.embed?.url || this.ref?.url);
        i.style.width = this.embedWidth;
        i.style.height = this.embedHeight;
        this.embedReady = true;
      }
    } else {
      delete this._oembed;
      defer(() => this.oembed = oembed);
    }
  }

  @memo
  get oembed(): Oembed | undefined {
    return this._oembed;
  }

  @memo
  get mod() {
    if (!this.admin.getPlugin('plugin/mod')) return false;
    if (!hasTag('plugin/mod', this.currentTags))  return false;
    return this.ref?.plugins?.['plugin/mod'];
  }

  @memo
  get hls() {
    return getExtension(this.ref?.plugins?.['plugin/video']?.url || this.ref?.url) === '.m3u8' || this.tags?.includes('plugin/hls');
  }

  @memo
  get twitter() {
    return this.oembed?.provider_name === 'Twitter';
  }

  @memo
  get zoom() {
    return this.oembed?.html && !this.oembed.html.startsWith('<iframe');
  }

  @memo
  get resizable() {
    if (this.config.mobile) return false;
    if (this.ref?.plugins?.['plugin/embed']?.noResize) return false;
    return !this.oembed || !this.oembed.html || this.oembed.html.startsWith('<iframe');
  }

  @memo
  get editingViewer() {
    return some(this.admin.editingViewer, t => hasTag(t.tag, this.currentTags));
  }

  @memo
  get hideComment() {
    if (this.ref?.tags?.includes('plugin/alt') || this.tags?.includes('plugin/alt')) return true;
    if (this.admin.getPlugin('plugin/table') && hasTag('plugin/table', this.currentTags)) return false;
    return this.editingViewer || (this.pdfUrl && !this.ref?.plugins?.['plugin/pdf']?.showAbstract);
  }

  @memo
  get currentOrigin() {
    return this.origin || this.ref?.origin || this.store.account.origin;
  }

  @memo
  get currentText() {
    if (this.hideComment) return '';
    const value = this.text || this.ref?.comment || '';
    if (!value) return '';
    if (this.ref?.title || this.text || hasTag('plugin/comment', this.ref) || hasTag('plugin/thread', this.ref) || this.store.view.current === 'ref/thread' || hasComment(this.ref?.comment)) {
      return value;
    }
    return '';
  }

  @memo
  get currentCode() {
    if (!this.code) return '';
    const value = this.text || this.ref?.comment || '';
    return '```' + this.codeLang + '\n' + value + '\n```';
  }

  @memo
  get currentTags() {
    return this.tags || this.ref?.tags || [];
  }

  @memo
  get thread() {
    if (!this.admin.getPlugin('plugin/thread')) return false;
    return hasTag('plugin/thread', this.currentTags) || this.ref?.metadata?.plugins?.['plugin/thread'];
  }

  @memo
  get embed() {
    if (!hasTag('plugin/embed', this.currentTags)) return undefined;
    return this.ref?.plugins?.['plugin/embed'];
  }

  get embedWidth() {
    if (this.embed?.width) return Math.min(this.embed.width, this.el.nativeElement.parentElement.offsetWidth - ((this.thread || !this.config.mobile) ? 32 : 12)) + 'px';
    if (this.config.mobile && window.matchMedia("(orientation: landscape)").matches) {
      return this.thread ? 'calc(100vw - 32px)' : 'calc(100vw - 12px)';
    }
    return `calc(min(100%, ${this.config.huge ? '67vw' : '80vw'}))`;
  }

  get embedHeight() {
    if (this.embed?.height) return Math.min(this.embed.height, window.innerHeight) + 'px';
    if (this.config.mobile && window.matchMedia("(orientation: landscape)").matches) {
      return '100vh';
    }
    return '67vh';
  }

  @memo
  get embedIframe() {
    return hasTag('plugin/embed', this.currentTags);
  }

  @memo
  get audioUrl() {
    if (!hasTag('plugin/audio', this.currentTags)) return '';
    const url = this.ref?.plugins?.['plugin/audio']?.url || this.ref?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/audio')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin, this.getFilename($localize`Untitled Audio`));
    }
    return url;
  }

  @memo
  get videoUrl() {
    if (!hasTag('plugin/video', this.currentTags)) return '';
    const url = this.ref?.plugins?.['plugin/video']?.url || this.ref?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/video')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin, this.getFilename($localize`Untitled Video`));
    }
    return url;
  }

  @memo
  get imageUrl() {
    if (!this.image && !hasTag('plugin/image', this.currentTags)) return '';
    const url = this.image || this.ref?.plugins?.['plugin/image']?.url || this.ref?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin, this.getFilename($localize`Untitled Image`));
    }
    return url;
  }

  @memo
  getFilename(d = $localize`Untitled`) {
    const ext = this.ref?.url ? getExtension(this.ref.url) || '' : '';
    const filename = this.ref?.title || d;
    return filename + (ext && !filename.toLowerCase().endsWith(ext) ? ext : '');
  }

  @memo
  get code() {
    return this.admin.getPlugin('plugin/code') && hasTag('plugin/code', this.currentTags);
  }

  @memo
  get codeLang() {
    if (!this.code) return '';
    for (const t of this.currentTags) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  }

  @memo
  get qrUrl() {
    if (!hasTag('plugin/qr', this.currentTags)) return '';
    return this.ref?.plugins?.['plugin/qr']?.url || this.ref?.url;
  }

  private get theme() {
    return this.store.darkTheme ? 'dark' : undefined;
  }

  @memo
  get pdf(): string | undefined {
    if (!this.admin.getPlugin('plugin/pdf')) return undefined;
    return pdfUrl(this.admin.getPlugin('plugin/pdf'), this.ref, this.repost)?.url;
  }

  @memo
  get pdfUrl() {
    const url = this.pdf;
    if (!url) return url;
    if (!this.admin.getPlugin('plugin/pdf')?.config?.proxy) return url;
    return this.proxy.getFetch(url, this.currentOrigin, this.getFilename());
  }

  @memo
  get uiActions(): PluginApi {
    const actions = this.actions.wrap(this.ref);
    return {
      comment: (comment: string) => {
        if (this.ref) {
          runInAction(() => this.ref!.comment = comment);
        } else {
          this.text = comment;
        }
        if (this.ref?.modified) actions.comment(comment);
        this.comment.emit(comment);
      },
      event: (event: string) => {
        actions.event(event);
      },
      emit: (a: EmitAction) => {
        actions.emit(a);
      },
      tag: (tag: string) => {
        if (this.ref?.modified) actions.tag(tag);
      },
      respond: (response: string, clear?: string[]) => {
        if (this.ref?.modified) actions.respond(response, clear);
      },
      watch: () => {
        if (this.ref?.modified) return actions.watch();
        const subject$ = new BehaviorSubject<RefUpdates>({ comment: this.text } as RefUpdates);
        return {
          ref$: subject$,
          comment$: (comment: string) => {
            this.text = comment;
            subject$.next({ comment: this.text } as RefUpdates)
            return of();
          },
        };
      },
      append: () => {
        if (this.ref?.modified) return actions.append();
        const subject$ = new Subject<string>();
        return {
          updates$: subject$,
          append$: (value: string) => {
            this.text += value;
            subject$.next(value);
            return of();
          },
        };
      },
    };
  }

  @memo
  uiMarkdown(tag: string) {
    const plugin = this.admin.getPlugin(tag)!;
    return hydrate(plugin.config, 'ui', getPluginScope(plugin, this.refOrDefault, this.el.nativeElement, this.uiActions));
  }

  @memo
  uiCss(tag: string) {
    return 'ui ' + tag.replace(/\//g, '_').replace(/\./g, '-');
  }

  @memo
  get refOrDefault() {
    return this.ref || { url: '', comment: this.text, tags: this.tags };
  }
}
