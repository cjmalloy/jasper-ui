import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  forwardRef,
  inject,
  OnDestroy,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import * as he from 'he';
import Hls from 'hls.js';
import { defer, isEqual, some, without } from 'lodash-es';
import { BehaviorSubject, catchError, of, Subject, throwError } from 'rxjs';
import { ImageDirective } from '../../directive/image.directive';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ResizeDirective } from '../../directive/resize.directive';
import { Ext } from '../../model/ext';
import { Oembed } from '../../model/oembed';
import { Page } from '../../model/page';
import { getPluginScope, PluginApi } from '../../model/plugin';
import { mapRef, Ref, RefSort, RefUpdates } from '../../model/ref';
import { EmitAction, hydrate } from '../../model/tag';
import { pdfUrl } from '../../mods/media/pdf';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { EmbedService } from '../../service/embed.service';
import { OembedStore } from '../../store/oembed';
import { Store } from '../../store/store';
import { embedUrl } from '../../util/embed';
import { hasComment, templates } from '../../util/format';
import { getExtension } from '../../util/http';
import { handleMediaKeydown } from '../../util/keyboard';
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
  host: {
    '[class]': 'pluginClasses',
    '[attr.tabindex]': 'tabIndex',
    '[class.fullscreen]': 'fullscreen()',
    '[attr.title]': 'title',
    '(keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => RefComponent),
    forwardRef(() => PlaylistComponent),
    forwardRef(() => LensComponent),
    forwardRef(() => ModComponent),
    forwardRef(() => MdComponent),
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
export class ViewerComponent implements OnDestroy {
  css = 'embed print-images';
  tabIndex = 0;
  private destroyRef = inject(DestroyRef);
  private videoKeydownHandler?: (event: KeyboardEvent) => void;
  private audioKeydownHandler?: (event: KeyboardEvent) => void;
  private fullscreenKeydownHandler?: (event: KeyboardEvent) => void;
  private fullscreenChangeHandler?: () => void;
  private currentVideo?: HTMLVideoElement;
  private currentAudio?: HTMLAudioElement;

  readonly iframe = viewChild.required<ElementRef>('iframe');
  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('video');
  readonly audioEl = viewChild<ElementRef<HTMLAudioElement>>('audio');
  readonly pdfIframeEl = viewChild<ElementRef<HTMLIFrameElement>>('pdfIframe');

  readonly refInput = input<Ref | undefined>(undefined, { alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());
  readonly commentControl = input<FormControl<string>>();
  readonly tagsInput = input<string[] | undefined>(undefined, { alias: 'tags' });
  readonly tags = linkedSignal(() => this.tagsInput());
  readonly expand = input(true);
  readonly autoplay = input(false);
  readonly textInput = input<string | undefined>('', { alias: 'text' });
  private readonly textSignal = linkedSignal(() => this.textInput());
  get text() {
    return this.textSignal() || '';
  }
  set text(value: string | undefined) {
    this.textSignal.set(value || '');
  }
  readonly origin = input<string | undefined>('');
  readonly disableResize = input(false);
  readonly fullscreenInput = input(false, { alias: 'fullscreen' });
  readonly fullscreen = linkedSignal(() => this.fullscreenInput());
  readonly comment = output<string>();
  readonly copied = output<string>();
  readonly playing = output<string>();
  readonly pausing = output<string>();
  readonly ended = output<string>();

  readonly repost = signal<Ref | undefined>(undefined);
  readonly lens = signal<boolean | undefined>(undefined);
  readonly lensPage = signal<Page<Ref> | undefined>(undefined);
  readonly ext = signal<Ext | undefined>(undefined);
  readonly lensQuery = signal('');
  readonly lensSize = signal(24);
  readonly lensCols = signal(0);
  readonly lensSort = signal<RefSort[]>([]);
  readonly lensFilter = signal<UrlFilter[]>([]);
  readonly lensSearch = signal('');
  readonly image = signal<string | undefined>(undefined);
  readonly playlist = signal(false);
  readonly todo = signal(false);
  readonly backgammon = signal(false);
  readonly chess = signal(false);
  readonly chessWhite = signal(true);
  readonly uis = signal<ReturnType<AdminService['getPluginUi']>>([]);
  readonly embedReady = signal(false);

  readonly oembed = signal<Oembed | undefined>(undefined);
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
    private auth: AuthzService,
    public el: ElementRef,
  ) {
    effect(() => {
      this.ref();
      this.tags();
      this.text;
      untracked(() => this.init());
    });
    effect(() => this.setVideo(this.videoEl()));
    effect(() => this.setAudio(this.audioEl()));
    effect(() => this.setPdfIframe(this.pdfIframeEl()));
  }

  init() {
    this.playlist.set(!!this.admin.getPlugin('plugin/playlist') && hasTag('plugin/playlist', this.currentTags));
    this.todo.set(!!this.admin.getPlugin('plugin/todo') && hasTag('plugin/todo', this.currentTags));
    this.backgammon.set(!!this.admin.getPlugin('plugin/backgammon') && hasTag('plugin/backgammon', this.currentTags));
    this.chess.set(!!this.admin.getPlugin('plugin/chess') && hasTag('plugin/chess', this.currentTags));
    this.chessWhite.set(!!this.ref()?.tags?.includes(this.store.account.localTag));
    this.uis.set(this.admin.getPluginUi(this.currentTags));
    if (this.ref()?.sources?.[0] && hasTag('plugin/repost', this.ref())) {
      this.refs.getCurrent(this.ref().sources[0]).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(ref => {
        this.repost.set(ref);
      });
    }
    const queryUrl = this.ref()?.plugins?.['plugin/lens']?.url || (hasTag('plugin/repost', this.ref()) ? this.ref()?.sources?.[0] : this.ref()?.url);
    if (queryUrl && hasTag('plugin/lens', this.ref())) {
      this.lens.set(true);
      this.embeds.loadQuery$(queryUrl)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(({params, page, ext}) => {
          this.lensPage.set(page);
          this.ext.set(ext);
          this.lensQuery.set(this.editor.getQuery(queryUrl));
          this.lensSize.set(params.size);
          this.lensCols.set(params.cols);
          this.lensSort.set(params.sort);
          this.lensFilter.set(params.filter);
          this.lensSearch.set(params.search);
          });
    }
    if (this.ref()?.url && hasTag('plugin/embed', this.currentTags)) {
      const parentWidth = this.el.nativeElement.parentElement.offsetWidth;
      this.width = this.embed?.width || ((this.thread || !this.config.mobile) ? Math.floor(parentWidth * 0.6) : parentWidth - 16);
      this.height = this.embed?.height || (this.config.mobile ? window.innerHeight : Math.floor(window.innerHeight * 0.8));
      if (hasTag('plugin/fullscreen', this.ref())) {
        this.width = screen.width;
        this.height = screen.height;
      }
      this.oembeds.get(this.ref().url, this.theme, this.width, this.height).subscribe(oembed => {
        this.setOembed(oembed);
      });
    }
    this.reload(this.currentAudio);
    this.reload(this.currentVideo);
    this.setPdfIframe(this.pdfIframeEl());
  }

  onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    if (this.currentVideo) {
      handleMediaKeydown(event, this.currentVideo);
      return;
    }
    if (this.currentAudio) {
      handleMediaKeydown(event, this.currentAudio);
      return;
    }
    const video = this.el.nativeElement.querySelector('video') as HTMLVideoElement;
    if (video) {
      handleMediaKeydown(event, video);
      return;
    }
    const audio = this.el.nativeElement.querySelector('audio') as HTMLAudioElement;
    if (audio) handleMediaKeydown(event, audio);
  }

  ngOnDestroy() {
    this.removeAudioListener();
    this.removeVideoListener();
  }

  get pluginClasses() {
    return this.css + ' ' + templates(this.tags(), 'plugin')
      .map(t => t.replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  }

  get title() {
    if (this.ref()?.tags?.includes('plugin/alt') || this.tags()?.includes('plugin/alt')) {
      return this.text || this.ref()?.comment;
    }
    return undefined;
  }

  private setVideo(value: ElementRef<HTMLVideoElement> | undefined) {
    this.removeVideoListener();
    if (!value) return;
    const video = value.nativeElement;
    this.currentVideo = video;
    this.videoKeydownHandler = (e: KeyboardEvent) => handleMediaKeydown(e, video);
    video.addEventListener('keydown', this.videoKeydownHandler, { capture: true });
    this.fullscreenKeydownHandler = (e: KeyboardEvent) => {
      if (document.fullscreenElement === video && !e.defaultPrevented) {
        handleMediaKeydown(e, video);
      }
    };
    document.addEventListener('keydown', this.fullscreenKeydownHandler, { capture: true });
    this.fullscreenChangeHandler = () => {
      if (!document.fullscreenElement && this.currentVideo) {
        this.el.nativeElement.focus();
      }
    };
    document.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
    if (video.canPlayType('application/vnd.apple.mpegurl')) return;
    if (Hls.isSupported() && this.hls) {
      const hls = new Hls();
      hls.loadSource(this.videoUrl);
      hls.attachMedia(video);
    }
  }

  private setAudio(value: ElementRef<HTMLAudioElement> | undefined) {
    this.removeAudioListener();
    if (!value) return;
    const audio = value.nativeElement;
    this.currentAudio = audio;
    this.audioKeydownHandler = (e: KeyboardEvent) => handleMediaKeydown(e, audio);
    audio.addEventListener('keydown', this.audioKeydownHandler, { capture: true });
  }

  private setPdfIframe(value: ElementRef<HTMLIFrameElement> | undefined) {
    if (!value) return;
    const iframe = value.nativeElement;
    let url = this.pdfUrl;
    if (!url) return;
    if (url.startsWith('//')) url = location.protocol + url;
    this.embeds.writeIframeHtml(`<embed type="application/pdf" src="${he.encode(url)}" width="100%" height="100%">`, iframe, false);
    iframe.style.width ||= this.embedWidth;
    iframe.style.height ||= this.embedHeight;
  }

  setOembed(oembed: Oembed | null) {
    if (isEqual(this.oembed(), oembed)) return;
    this.oembed.set(oembed || undefined);
    const iframe = this.iframe();
    if (oembed?.url && oembed?.type === 'photo') {
      // Image embed
      this.tags.set(without(this.currentTags, 'plugin/embed'));
      this.image.set(embedUrl(oembed.url));
    } else if (iframe) {
      const i = iframe.nativeElement;
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
            this.embedReady.set(true);
              });
      } else {
        i.src = embedUrl(this.embed?.url || this.ref()?.url);
        if (!i.style.width) i.style.width = this.embedWidth;
        if (!i.style.height) i.style.height = this.embedHeight;
        this.embedReady.set(true);
      }
    } else {
      this.oembed.set(undefined);
      defer(() => this.setOembed(oembed));
    }
  }


  get mod() {
    if (!this.admin.getPlugin('plugin/mod')) return false;
    if (!hasTag('plugin/mod', this.currentTags))  return false;
    return this.ref()?.plugins?.['plugin/mod'];
  }

  get hls() {
    return getExtension(this.ref()?.plugins?.['plugin/video']?.url || this.ref()?.url) === '.m3u8' || this.tags()?.includes('plugin/hls');
  }

  get twitter() {
    return this.oembed()?.provider_name === 'Twitter';
  }

  get zoom() {
    return this.oembed()?.html && !this.oembed().html.startsWith('<iframe');
  }

  get resizable() {
    if (this.config.mobile) return false;
    if (this.ref()?.plugins?.['plugin/embed']?.noResize) return false;
    return !this.oembed() || !this.oembed().html || this.oembed().html.startsWith('<iframe');
  }

  get editingViewer() {
    return some(this.admin.editingViewer, t => hasTag(t.tag, this.currentTags));
  }

  get editingRef(): Ref | undefined {
    if (!hasTag('plugin/editing', this.currentTags)) return undefined;
    const data = this.ref()?.plugins?.['plugin/editing'];
    if (!data) return undefined;
    const result = mapRef({ ...data, url: this.ref()?.url, origin: this.ref()?.origin });
    if (!result.created) result.created = this.ref()?.created;
    return result;
  }

  get hideComment() {
    if (this.ref()?.tags?.includes('plugin/alt') || this.tags()?.includes('plugin/alt')) return true;
    if (this.admin.getPlugin('plugin/table') && hasTag('plugin/table', this.currentTags)) return false;
    return this.editingViewer || (this.pdfUrl && !this.ref()?.plugins?.['plugin/pdf']?.showAbstract);
  }

  get currentOrigin() {
    return this.origin() || this.ref()?.origin || this.store.account.origin;
  }

  get currentText() {
    if (this.hideComment) return '';
    const value = this.text || this.ref()?.comment || '';
    if (!value) return '';
    if (this.ref()?.title || this.text || hasTag('plugin/comment', this.ref()) || hasTag('plugin/thread', this.ref()) || this.store.view.current === 'ref/thread' || hasComment(this.ref()?.comment)) {
      return value;
    }
    return '';
  }

  get currentCode() {
    if (!this.code) return '';
    const value = this.text || this.ref()?.comment || '';
    return '```' + this.codeLang + '\n' + value + '\n```';
  }

  get currentTags() {
    return this.tags() || this.ref()?.tags || [];
  }

  get thread() {
    if (!this.admin.getPlugin('plugin/thread')) return false;
    return hasTag('plugin/thread', this.currentTags) || this.ref()?.metadata?.plugins?.['plugin/thread'];
  }

  get embed() {
    if (!hasTag('plugin/embed', this.currentTags)) return undefined;
    return this.ref()?.plugins?.['plugin/embed'];
  }

  get embedWidth() {
    if (this.embed?.width) return Math.min(this.embed.width, this.el.nativeElement.parentElement.offsetWidth - ((this.thread || !this.config.mobile) ? 32 : 12)) + 'px';
    if (this.config.mobile && window.matchMedia("(orientation: landscape)").matches) {
      return this.thread ? 'calc(100vw - 32px)' : 'calc(100vw - 12px)';
    }
    return this.config.huge ? '67%' : '80%';
  }

  get embedHeight() {
    if (this.embed?.height) return Math.min(this.embed.height, window.innerHeight) + 'px';
    if (this.config.mobile && window.matchMedia("(orientation: landscape)").matches) {
      return '100vh';
    }
return '67vh';
  }

  get embedIframe() {
    return hasTag('plugin/embed', this.currentTags);
  }

  get audioUrl() {
    if (!hasTag('plugin/audio', this.currentTags)) return '';
    const url = this.ref()?.plugins?.['plugin/audio']?.url || this.ref()?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/audio')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin, this.getFilename($localize`Untitled Audio`));
    }
    return url;
  }

  get videoUrl() {
    if (!hasTag('plugin/video', this.currentTags)) return '';
    const url = this.ref()?.plugins?.['plugin/video']?.url || this.ref()?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/video')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin, this.getFilename($localize`Untitled Video`));
    }
    return url;
  }

  get imageUrl() {
    if (!this.image() && !hasTag('plugin/image', this.currentTags)) return '';
    const url = this.image() || this.ref()?.plugins?.['plugin/image']?.url || this.ref()?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin, this.getFilename($localize`Untitled Image`));
    }
    return url;
  }

  getFilename(d = $localize`Untitled`) {
    const ext = this.ref()?.url ? getExtension(this.ref().url) || '' : '';
    const filename = this.ref()?.title || d;
    return filename + (ext && !filename.toLowerCase().endsWith(ext) ? ext : '');
  }

  get code() {
    return this.admin.getPlugin('plugin/code') && hasTag('plugin/code', this.currentTags);
  }

  get codeLang() {
    if (!this.code) return '';
    for (const t of this.currentTags) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  }

  get qrUrl() {
    if (!hasTag('plugin/qr', this.currentTags)) return '';
    return this.ref()?.plugins?.['plugin/qr']?.url || this.ref()?.url;
  }

  private get theme() {
    return this.store.darkTheme ? 'dark' : undefined;
  }

  get pdf(): string | undefined {
    if (!this.admin.getPlugin('plugin/pdf')) return undefined;
    return pdfUrl(this.admin.getPlugin('plugin/pdf'), this.ref(), this.repost())?.url;
  }

  get pdfUrl() {
    const url = this.pdf;
    if (!url) return url;
    if (!this.admin.getPlugin('plugin/pdf')?.config?.proxy) return url;
    return this.proxy.getFetch(url, this.currentOrigin, this.getFilename());
  }

  get uiActions(): PluginApi {
    const actions = this.actions.wrap(this.ref());
    const api: PluginApi = {
      comment: (comment: string) => {
        if (this.ref()) {
          this.ref().comment = comment;
        } else {
          this.text = comment;
        }
        if (this.ref()?.modified) actions.comment(comment);
        this.comment.emit(comment);
      },
      event: (event: string) => {
        actions.event(event);
      },
      emit: (a: EmitAction) => {
        actions.emit(a);
      },
      tag: (tag: string) => {
        if (this.ref()?.modified) actions.tag(tag);
      },
      respond: (response: string, clear?: string[]) => {
        if (this.ref()?.modified) actions.respond(response, clear);
      },
      watch: () => {
        if (this.ref()?.modified) return actions.watch();
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
        if (this.ref()?.modified) return actions.append();
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
    if (!this.ref()?.modified || this.auth.writeAccess(this.ref())) {
      api.patch = (patch: Partial<Ref>) => {
        if (this.ref()?.modified) {
          actions.patch!(patch);
        } else if (this.ref()) {
          const plugins = patch.plugins ? { ...this.ref().plugins, ...patch.plugins } : this.ref().plugins;
          Object.assign(this.ref(), patch);
          if (patch.plugins) {
            this.ref().plugins = plugins;
            for (const updateTag of Object.keys(patch.plugins)) {
              if (!hasTag(updateTag, this.ref())) {
                this.ref().tags = [...(this.ref().tags || []), updateTag];
              }
            }
          }
          }
      };
    }
    return api;
  }

  uiMarkdown(tag: string) {
    const plugin = this.admin.getPlugin(tag)!;
    return hydrate(plugin.config, 'ui', getPluginScope(plugin, this.refOrDefault, this.el.nativeElement, this.uiActions));
  }

  uiCss(tag: string) {
    return 'ui ' + tag.replace(/\//g, '_').replace(/\./g, '-');
  }

  get refOrDefault() {
    return this.ref() || { url: '', comment: this.text, tags: this.tags() };
  }

  private removeAudioListener() {
    if (this.currentAudio && this.audioKeydownHandler) {
      this.currentAudio.removeEventListener('keydown', this.audioKeydownHandler, { capture: true });
    }
    this.currentAudio = undefined;
    this.audioKeydownHandler = undefined;
  }

  private removeVideoListener() {
    if (this.currentVideo && this.videoKeydownHandler) {
      this.currentVideo.removeEventListener('keydown', this.videoKeydownHandler, { capture: true });
    }
    this.currentVideo = undefined;
    this.videoKeydownHandler = undefined;
    if (this.fullscreenKeydownHandler) {
      document.removeEventListener('keydown', this.fullscreenKeydownHandler, { capture: true });
    }
    this.fullscreenKeydownHandler = undefined;
    if (this.fullscreenChangeHandler) {
      document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler);
    }
    this.fullscreenChangeHandler = undefined;
  }

  private reload(m?: HTMLMediaElement) {
    if (!m) return;
    const autoplay = !m.paused;
    m.load();
    if (autoplay) {
      m.play().catch((error) => {
        console.warn('Playback deferred by browser autoplay restrictions:', error);
      });
    }
  }
}
