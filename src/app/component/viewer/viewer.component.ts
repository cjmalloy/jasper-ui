import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import * as he from 'he';
import Hls from 'hls.js';
import { isEqual, some, without } from 'lodash-es';
import { BehaviorSubject, catchError, of, startWith, Subject, switchMap } from 'rxjs';
import { ImageDirective } from '../../directive/image.directive';
import { ResizeHandleDirective } from '../../directive/resize-handle.directive';
import { ResizeDirective } from '../../directive/resize.directive';
import { Oembed } from '../../model/oembed';
import { Page } from '../../model/page';
import { getPluginScope, PluginApi } from '../../model/plugin';
import { mapRef, Ref, RefUpdates } from '../../model/ref';
import { DownloadAction, EmitAction, hydrate } from '../../model/tag';
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
import { embedUrl, setIframeSrc } from '../../util/embed';
import { hasComment, templates } from '../../util/format';
import { getExtension } from '../../util/http';
import { handleMediaKeydown } from '../../util/keyboard';
import { hasPrefix, hasTag } from '../../util/tag';
import { BackgammonComponent } from '../backgammon/backgammon.component';
import { ChessComponent } from '../chess/chess.component';
import { LensComponent } from '../lens/lens.component';
import { LoadingComponent } from '../loading/loading.component';
import { MapComponent } from '../map/map.component';
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
    '[class]': "pluginClasses()",
    '[attr.tabindex]': 'tabIndex',
    '[class.fullscreen]': 'fullscreen()',
    '[attr.title]': "title()",
    '(keydown)': 'onKeydown($event)',
    '(window:resize)': 'measureLayout()',
  },
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
    MapComponent,
    ResizeHandleDirective,
    LoadingComponent,
  ],
})
export class ViewerComponent {
  config = inject(ConfigService);
  admin = inject(AdminService);
  private proxy = inject(ProxyService);
  private oembeds = inject(OembedStore);
  private actions = inject(ActionService);
  private embeds = inject(EmbedService);
  private editor = inject(EditorService);
  private refs = inject(RefService);
  readonly store = inject(Store);
  private auth = inject(AuthzService);
  el = inject(ElementRef);

  css = 'embed print-images';
  tabIndex = 0;
  private destroyRef = inject(DestroyRef);
  private videoKeydownHandler?: (event: KeyboardEvent) => void;
  private audioKeydownHandler?: (event: KeyboardEvent) => void;
  private fullscreenKeydownHandler?: (event: KeyboardEvent) => void;
  private fullscreenChangeHandler?: () => void;
  private currentVideo?: HTMLVideoElement;
  private currentAudio?: HTMLAudioElement;

  readonly iframe = viewChild<ElementRef>('iframe');
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
  readonly text = linkedSignal(() => this.textInput() || '');
  readonly origin = input<string | undefined>('');
  readonly disableResize = input(false);
  readonly fullscreenInput = input(false, { alias: 'fullscreen' });
  readonly fullscreen = linkedSignal(() => this.fullscreenInput());
  readonly comment = output<string>();
  readonly copied = output<string>();
  readonly playing = output<string>();
  readonly pausing = output<string>();
  readonly ended = output<string>();

  readonly repost = toSignal(toObservable(computed(() =>
    hasTag('plugin/repost', this.ref()) ? this.ref()?.sources?.[0] : undefined,
  )).pipe(switchMap(url => url ? this.refs.getCurrent(url).pipe(
    catchError(() => of(undefined)),
    startWith(undefined),
  ) : of(undefined))), { initialValue: undefined });
  private readonly queryUrl = computed(() => hasTag('plugin/lens', this.ref())
    ? this.ref()?.plugins?.['plugin/lens']?.url || (hasTag('plugin/repost', this.ref()) ? this.ref()?.sources?.[0] : this.ref()?.url)
    : undefined);
  private readonly lensResult = toSignal(toObservable(this.queryUrl).pipe(
    switchMap(url => url ? this.embeds.loadQuery$(url).pipe(
      catchError(() => of(undefined)),
      startWith(undefined),
    ) : of(undefined)),
  ), { initialValue: undefined });
  readonly lens = computed(() => !!this.queryUrl());
  readonly lensPage = computed(() => this.lensResult()?.page);
  readonly ext = computed(() => this.lensResult()?.ext);
  readonly lensQuery = computed(() => this.queryUrl() ? this.editor.getQuery(this.queryUrl()!) : '');
  readonly lensSize = computed(() => this.lensResult()?.params.size ?? 24);
  readonly lensCols = computed(() => this.lensResult()?.params.cols ?? 0);
  readonly lensSort = computed(() => this.lensResult()?.params.sort ?? []);
  readonly lensFilter = computed(() => this.lensResult()?.params.filter ?? []);
  readonly lensSearch = computed(() => this.lensResult()?.params.search ?? '');
  readonly image = computed(() => this.oembed()?.type === 'photo' && this.oembed()?.url
    ? embedUrl(this.oembed()!.url) : undefined);
  readonly playlist = computed(() => !!this.admin.getPlugin('plugin/playlist') && hasTag('plugin/playlist', this.currentTags()));
  readonly todo = computed(() => !!this.admin.getPlugin('plugin/todo') && hasTag('plugin/todo', this.currentTags()));
  readonly backgammon = computed(() => !!this.admin.getPlugin('plugin/backgammon') && hasTag('plugin/backgammon', this.currentTags()));
  readonly chess = computed(() => !!this.admin.getPlugin('plugin/chess') && hasTag('plugin/chess', this.currentTags()));
  readonly chessWhite = computed(() => !!this.ref()?.tags?.includes(this.store.account.localTag()));
  readonly uis = computed(() => this.admin.getPluginUi(this.currentTags()));
  readonly embedReady = signal(false);
  readonly map = computed(() => !!this.admin.getPlugin('plugin/geo') && !!this.ref() && hasTag('plugin/geo', this.currentTags()));
  readonly mapPage = computed(() => this.map() ? Page.of([this.ref()!]) : undefined);

  private readonly layout = signal({ parentWidth: 0, height: window.innerHeight, landscape: false });
  private readonly embedSize = signal<{ width: number, height: number } | undefined>(undefined, { equal: isEqual });
  private readonly oembedRequest = computed(() => {
    const url = this.ref()?.url;
    const size = this.embedSize();
    if (!url || !size || !hasTag('plugin/embed', this.tags() || this.ref()?.tags)) return undefined;
    return { url, theme: this.theme(), ...size };
  }, { equal: isEqual });
  /** undefined while loading, null if there is no oEmbed. */
  readonly oembed = toSignal(toObservable(this.oembedRequest).pipe(
    switchMap(request => request ? this.oembeds.get(request.url, request.theme, request.width, request.height).pipe(
      catchError(() => of(null)),
      startWith(undefined),
    ) : of(undefined)),
  ), { initialValue: undefined as Oembed | null | undefined });
  private prevRef?: Ref;
  private prevTags?: string[];
  private prevText?: string;
  private initialized = false;

  constructor() {
    // Syncs embedded media and oEmbed sizing to Ref changes
    effect(() => {
      const ref = this.refInput();
      const tags = this.tagsInput();
      const text = this.textInput();
      untracked(() => {
        const newRef = ref?.url !== this.prevRef?.url;
        const changesRef = !this.initialized || ref?.modifiedString !== this.prevRef?.modifiedString || newRef;
        const changesTags = !isEqual(tags, this.prevTags);
        const changesText = text !== this.prevText;
        this.initialized = true;
        this.prevRef = ref;
        this.prevTags = tags;
        this.prevText = text;
        if (!changesRef && !changesTags && !changesText) return;
        if (this.editingViewer() && !newRef) return;
        this.init();
      });
    });
    effect(() => {
      const value = this.videoEl();
      untracked(() => this.setVideo(value));
    });
    effect(() => {
      const value = this.audioEl();
      untracked(() => this.setAudio(value));
    });
    effect(() => {
      const value = this.pdfIframeEl();
      untracked(() => this.setPdfIframe(value));
    });
    effect(() => {
      const oembed = this.oembed();
      this.iframe();
      if (oembed === undefined || !this.embedIframe()) return;
      untracked(() => this.setOembed(oembed));
    });
  }

  init() {
    this.measureLayout();
    const ref = this.ref();
    const layout = this.layout();
    if (hasTag('plugin/fullscreen', ref)) {
      this.embedSize.set({ width: screen.width, height: screen.height });
    } else {
      this.embedSize.set({
        width: ref?.plugins?.['plugin/embed']?.width || ((hasTag('plugin/thread', this.tags() || ref?.tags) || !this.config.mobile()) ? Math.floor(layout.parentWidth * 0.6) : layout.parentWidth - 16),
        height: ref?.plugins?.['plugin/embed']?.height || (this.config.mobile() ? layout.height : Math.floor(layout.height * 0.8)),
      });
    }
    this.reload(this.currentAudio);
    this.reload(this.currentVideo);
    this.setPdfIframe(this.pdfIframeEl());
  }

  private readonly initializeLayout = afterNextRender(() => this.measureLayout());

  measureLayout() {
    const parentWidth = this.el.nativeElement.parentElement?.offsetWidth || 0;
    const height = window.innerHeight;
    const landscape = window.matchMedia?.('(orientation: landscape)').matches || false;
    const layout = this.layout();
    if (layout.parentWidth !== parentWidth || layout.height !== height || layout.landscape !== landscape) {
      this.layout.set({ parentWidth, height, landscape });
    }
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

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.removeAudioListener();
    this.removeVideoListener();
  });

  readonly pluginClasses = computed(() => {
    return this.css + ' ' + templates(this.tags(), 'plugin')
      .map(t => t.replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  });

  readonly title = computed(() => {
    if (this.ref()?.tags?.includes('plugin/alt') || this.tags()?.includes('plugin/alt')) {
      return this.text() || this.ref()?.comment;
    }
    return undefined;
  });

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
    if (Hls.isSupported() && this.hls()) {
      const hls = new Hls();
      hls.loadSource(this.videoUrl());
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
    let url = this.pdfUrl();
    if (!url) return;
    if (url.startsWith('//')) url = location.protocol + url;
    this.embeds.writeIframeHtml(`<embed type="application/pdf" src="${he.encode(url)}" width="100%" height="100%">`, iframe, false);
    iframe.style.width ||= this.embedWidth();
    iframe.style.height ||= this.embedHeight();
  }

  setOembed(oembed: Oembed | null) {
    const iframe = this.iframe();
    if (oembed?.type === 'photo') return;
    if (iframe) {
      const i = iframe.nativeElement;
      this.embedReady.set(false);
      if (oembed) {
        this.embeds.writeIframe(oembed, i, this.embedWidth(), true)
          .then(() => {
            if (this.oembed() !== oembed || this.iframe()?.nativeElement !== i) return;
            const width = this.embedSize()?.width || 0;
            if (oembed.width! > width) {
              const s = width / oembed.width!;
              const marginLeft = oembed.width! - width;
              const marginTop = marginLeft * oembed.height! / oembed.width!;
              i.style.transform = `scale(${s}, ${s})`;
              i.style.transformOrigin = 'top left';
              i.style.marginRight = -1 * marginLeft + 'px';
              i.style.marginBottom = -1 * marginTop + 'px';
            }
            this.embedReady.set(true);
              });
      } else {
        setIframeSrc(i, embedUrl(this.embed()?.url || this.ref()?.url));
        if (!i.style.width) i.style.width = this.embedWidth();
        if (!i.style.height) i.style.height = this.embedHeight();
        this.embedReady.set(true);
      }
    }
  }

  readonly mod = computed(() => {
    if (!this.admin.getPlugin('plugin/mod')) return false;
    if (!hasTag('plugin/mod', this.currentTags()))  return false;
    return this.ref()?.plugins?.['plugin/mod'];
  });

  readonly hls = computed(() => {
    return getExtension(this.ref()?.plugins?.['plugin/video']?.url || this.ref()?.url) === '.m3u8' || this.tags()?.includes('plugin/hls');
  });

  readonly twitter = computed(() => {
    return this.oembed()?.provider_name === 'Twitter';
  });

  readonly zoom = computed(() => {
    const html = this.oembed()?.html;
    return html && !html.startsWith('<iframe');
  });

  readonly resizable = computed(() => {
    if (this.config.mobile()) return false;
    if (this.ref()?.plugins?.['plugin/embed']?.noResize) return false;
    const html = this.oembed()?.html;
    return !html || html.startsWith('<iframe');
  });

  readonly editingViewer = computed(() => {
    return some(this.admin.editingViewer(), t => hasTag(t.tag, this.currentTags()));
  });

  readonly editingRef = computed<Ref | undefined>(() => {
    if (!hasTag('plugin/editing', this.currentTags())) return undefined;
    const data = this.ref()?.plugins?.['plugin/editing'];
    if (!data) return undefined;
    const result = mapRef({ ...data, url: this.ref()?.url, origin: this.ref()?.origin });
    if (!result.created) result.created = this.ref()?.created;
    return result;
  });

  readonly hideComment = computed(() => {
    if (this.ref()?.tags?.includes('plugin/alt') || this.tags()?.includes('plugin/alt')) return true;
    if (this.admin.getPlugin('plugin/table') && hasTag('plugin/table', this.currentTags())) return false;
    return this.editingViewer() || (this.pdfUrl() && !this.ref()?.plugins?.['plugin/pdf']?.showAbstract);
  });

  readonly currentOrigin = computed(() => {
    return this.origin() || this.ref()?.origin || this.store.account.origin();
  });

  readonly currentText = computed(() => {
    if (this.hideComment()) return '';
    const value = this.text() || this.ref()?.comment || '';
    if (!value) return '';
    if (this.ref()?.title || this.text() || hasTag('plugin/comment', this.ref()) || hasTag('plugin/thread', this.ref()) || this.store.view.current() === 'ref/thread' || hasComment(this.ref()?.comment)) {
      return value;
    }
    return '';
  });

  readonly currentCode = computed(() => {
    if (!this.code()) return '';
    const value = this.text() || this.ref()?.comment || '';
    return '```' + this.codeLang() + '\n' + value + '\n```';
  });

  readonly currentTags = computed(() => {
    const tags = this.tags() || this.ref()?.tags || [];
    return this.image() ? without(tags, 'plugin/embed') : tags;
  });

  readonly thread = computed(() => {
    if (!this.admin.getPlugin('plugin/thread')) return false;
    return hasTag('plugin/thread', this.currentTags()) || this.ref()?.metadata?.plugins?.['plugin/thread'];
  });

  readonly embed = computed(() => {
    if (!hasTag('plugin/embed', this.currentTags())) return undefined;
    return this.ref()?.plugins?.['plugin/embed'];
  });

  readonly embedWidth = computed(() => {
    if (this.embed()?.width) return Math.min(this.embed().width, this.layout().parentWidth - ((this.thread() || !this.config.mobile()) ? 32 : 12)) + 'px';
    if (this.config.mobile() && this.layout().landscape) {
      return this.thread() ? 'calc(100vw - 32px)' : 'calc(100vw - 12px)';
    }
    return this.config.huge() ? '67%' : '80%';
  });

  readonly embedHeight = computed(() => {
    if (this.embed()?.height) return Math.min(this.embed().height, this.layout().height) + 'px';
    if (this.config.mobile() && this.layout().landscape) {
      return '100vh';
    }
    return '67vh';
  });

  readonly embedIframe = computed(() => {
    return hasTag('plugin/embed', this.currentTags());
  });

  readonly audioUrl = computed(() => {
    if (!hasTag('plugin/audio', this.currentTags())) return '';
    const url = this.ref()?.plugins?.['plugin/audio']?.url || this.ref()?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/audio')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin(), this.getFilename($localize`Untitled Audio`));
    }
    return url;
  });

  readonly videoUrl = computed(() => {
    if (!hasTag('plugin/video', this.currentTags())) return '';
    const url = this.ref()?.plugins?.['plugin/video']?.url || this.ref()?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/video')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin(), this.getFilename($localize`Untitled Video`));
    }
    return url;
  });

  readonly imageUrl = computed(() => {
    if (!this.image() && !hasTag('plugin/image', this.currentTags())) return '';
    const url = this.image() || this.ref()?.plugins?.['plugin/image']?.url || this.ref()?.url;
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy) {
      return this.proxy.getFetch(url, this.currentOrigin(), this.getFilename($localize`Untitled Image`));
    }
    return url;
  });

  getFilename(d = $localize`Untitled`) {
    const url = this.ref()?.url;
    const ext = url ? getExtension(url) || '' : '';
    const filename = this.ref()?.title || d;
    return filename + (ext && !filename.toLowerCase().endsWith(ext) ? ext : '');
  }

  readonly code = computed(() => {
    return this.admin.getPlugin('plugin/code') && hasTag('plugin/code', this.currentTags());
  });

  readonly codeLang = computed(() => {
    if (!this.code()) return '';
    for (const t of this.currentTags()) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  });

  readonly qrUrl = computed(() => {
    if (!hasTag('plugin/qr', this.currentTags())) return '';
    return this.ref()?.plugins?.['plugin/qr']?.url || this.ref()?.url;
  });

  private readonly theme = computed(() => {
    return this.store.darkTheme() ? 'dark' : undefined;
  });

  readonly pdf = computed<string | undefined>(() => {
    if (!this.admin.getPlugin('plugin/pdf')) return undefined;
    return pdfUrl(this.admin.getPlugin('plugin/pdf'), this.ref(), this.repost())?.url;
  });

  readonly pdfUrl = computed(() => {
    const url = this.pdf();
    if (!url) return url;
    if (!this.admin.getPlugin('plugin/pdf')?.config?.proxy) return url;
    return this.proxy.getFetch(url, this.currentOrigin(), this.getFilename());
  });

  readonly uiActions = computed<PluginApi>(() => {
    const actions = this.actions.wrap(this.ref());
    const api: PluginApi = {
      comment: (comment: string) => {
        if (this.ref()) {
          this.ref.update(ref => ({ ...ref!, comment }));
        } else {
          this.text.set(comment);
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
      download: (a: DownloadAction) => {
        actions.download(a);
      },
      tag: (tag: string) => {
        if (this.ref()?.modified) actions.tag(tag);
      },
      respond: (response: string, clear?: string[]) => {
        if (this.ref()?.modified) actions.respond(response, clear);
      },
      watch: () => {
        if (this.ref()?.modified) return actions.watch();
        const subject$ = new BehaviorSubject<RefUpdates>({ comment: this.text() } as RefUpdates);
        return {
          ref$: subject$,
          comment$: (comment: string) => {
            this.text.set(comment);
            subject$.next({ comment: this.text() } as RefUpdates)
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
            this.text.update(text => text + value);
            subject$.next(value);
                return of();
          },
        };
      },
    };
    if (!this.ref()?.modified || this.auth.writeAccess(this.ref()!)) {
      api.patch = (patch: Partial<Ref>) => {
        if (this.ref()?.modified) {
          actions.patch!(patch);
        } else {
          const ref = this.ref();
          if (!ref) return;
          const updated: Ref = { ...ref, ...patch };
          if (patch.plugins) {
            updated.plugins = { ...ref.plugins, ...patch.plugins };
            for (const updateTag of Object.keys(patch.plugins)) {
              if (!hasTag(updateTag, updated)) {
                updated.tags = [...(updated.tags || []), updateTag];
              }
            }
          }
          this.ref.set(updated);
        }
      };
    }
    return api;
  });

  /** Hydrated plugin UIs. Hydrating runs the template's deferred scripts, so only redo it when the inputs change. */
  readonly uiMarkdowns = computed(() => {
    const ref = this.refOrDefault();
    const actions = this.uiActions();
    return this.uis().map(ui => {
      const plugin = this.admin.getPlugin(ui.tag)!;
      return {
        tag: ui.tag,
        text: hydrate(plugin.config, 'ui', getPluginScope(plugin, ref, this.el.nativeElement, actions)),
      };
    });
  });

  uiCss(tag: string) {
    return 'ui ' + tag.replace(/\//g, '_').replace(/\./g, '-');
  }

  readonly refOrDefault = computed(() => {
    return this.ref() || { url: '', comment: this.text(), tags: this.tags() };
  });

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
