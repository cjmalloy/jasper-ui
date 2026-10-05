import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { cloneDeep, defer, delay, groupBy, pick, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, map, Observable, of, startWith, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { TitleDirective } from '../../directive/title.directive';
import { DiffComponent } from '../../form/diff/diff.component';
import { writePlugins } from '../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { getPluginScope } from '../../model/plugin';
import { equalsRef, isRef, Ref } from '../../model/ref';
import { Action, active, hydrate, Icon, sortOrder, uniqueConfigs, visible } from '../../model/tag';
import { deleteNotice } from '../../mods/delete';
import { addressedTo, getMailbox, mailboxes } from '../../mods/mailbox';
import { CssUrlPipe } from '../../pipe/css-url.pipe';
import { RelativePipe } from '../../pipe/relative.pipe';
import { isInlineSvg, ThumbnailPipe } from '../../pipe/thumbnail.pipe';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { ImageService } from '../../service/image.service';
import { UploadCacheService } from '../../service/upload-cache.service';
import { Store } from '../../store/store';
import { controlState, controlValue, scrollToFirstInvalid } from '../../util/form';
import {
  authors,
  clickableLink,
  formatAuthor,
  getTitle,
  hasComment,
  interestingTags,
  templates,
  urlSummary
} from '../../util/format';
import { getExtension, getScheme, printError } from '../../util/http';
import { markRead } from '../../util/response';
import {
  storyboardAnimation,
  storyboardHeight,
  storyboardMargin,
  storyboardSize,
  storyboardUrl,
  storyboardWidth
} from '../../util/storyboard';
import {
  capturesAny,
  expandedTagsInclude,
  hasPrefix,
  hasTag,
  hasUserUrlResponse,
  isAuthorTag,
  localTag,
  removeTag,
  subOrigin,
  tagOrigin,
  top
} from '../../util/tag';
import { ActionListComponent } from '../action/action-list/action-list.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from '../action/inline-button/inline-button.component';
import { InlineTagComponent } from '../action/inline-tag/inline-tag.component';
import { CommentReplyComponent } from '../comment/comment-reply/comment-reply.component';
import { LoadingComponent } from '../loading/loading.component';
import { MdComponent } from '../md/md.component';
import { NavComponent } from '../nav/nav.component';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  host: {
    '[class]': 'allCss()',
    '[class.deleted]': 'deleted()',
    '[class.editing]': 'editing()',
    '[class.mobile-unlock]': 'mobileUnlock()',
    '[class.storyboard-ready]': 'storyboardLoaded()',
    '[attr.data-ref-url]': "refUrlAttr()",
    '[attr.data-ref-origin]': "refOriginAttr()",
    '[attr.data-ref-title]': "refTitleAttr()",
    '[attr.data-ref-thumbnail-url]': "refThumbnailUrlAttr()",
    '[attr.data-ref-thumbnail-color]': "refThumbnailColorAttr()",
    '[attr.data-ref-thumbnail-emoji]': "refThumbnailEmojiAttr()",
    '[attr.data-ref-thumbnail-radius]': "refThumbnailRadiusAttr()",
    '[class.last-selected]': "lastSelected()",
    '[class.upload]': "uploadedFile()",
    '[class.exists]': "existsFile()",
    '[class.outdated]': "modifiedFile()",
    '[class.sent]': "isAuthor()",
    '[style.--storyboard-url]': "storyboardUrl()",
    '[style.--storyboard-size]': "storyboardSize()",
    '[style.--storyboard-margin]': "storyboardMargin()",
    '[style.--storyboard-width]': "storyboardWidth()",
    '[style.--storyboard-height]': "storyboardHeight()",
    '[style.--storyboard-animation]': 'storyboardAnimation()',
    '(fullscreenchange)': 'onFullscreenChange()',
    '(click)': 'onClick()',
  },
  imports: [
    RelativePipe,
    FakeLinkDirective,
    forwardRef(() => ViewerComponent),
    forwardRef(() => RefFormComponent),
    forwardRef(() => MdComponent),
    NavComponent,
    RouterLink,
    TitleDirective,
    InlineTagComponent,
    InlineButtonComponent,
    ConfirmActionComponent,
    ActionListComponent,
    CommentReplyComponent,
    ReactiveFormsModule,
    LoadingComponent,
    DiffComponent,
    AsyncPipe,
    ThumbnailPipe,
    CssUrlPipe,
  ],
})
export class RefComponent implements HasChanges {
  config = inject(ConfigService);
  accounts = inject(AccountService);
  admin = inject(AdminService);
  store = inject(Store);
  private auth = inject(AuthzService);
  private editor = inject(EditorService);
  private refs = inject(RefService);
  private exts = inject(ExtService);
  private bookmarks = inject(BookmarkService);
  private proxy = inject(ProxyService);
  private uploadCache = inject(UploadCacheService);
  private ts = inject(TaggingService);
  private router = inject(Router);
  private fb = inject(UntypedFormBuilder);
  private el = inject<ElementRef<HTMLDivElement>>(ElementRef);
  private imgs = inject(ImageService);

  private readonly controlState0 = controlValue(() => this.editForm);


  css = 'ref list-item';
  readonly allCss = computed(() => this.getPluginClasses());
  private destroyRef = inject(DestroyRef);

  readonly refForm = viewChild<RefFormComponent>('refForm');
  readonly reply = viewChild<CommentReplyComponent>('reply');
  readonly diffEditor = viewChild<any>('diffEditor');
  readonly viewer = viewChild<ViewerComponent>('viewer');

  readonly refInput = input<Ref | undefined>(undefined, { alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput()!);
  readonly expandedInput = input(false, { alias: 'expanded' });
  readonly expanded = linkedSignal(() => this.expandedInput());
  readonly plugins = input<string[]>();
  readonly expandInlineInput = input(false, { alias: 'expandInline' });
  readonly expandInline = linkedSignal(() => this.expandInlineInput());
  readonly showToggleInput = input(false, { alias: 'showToggle' });
  readonly showToggle = linkedSignal(() => this.showToggleInput());
  readonly scrollToLatest = input(false);
  readonly hideEdit = input(false);
  readonly disableResize = input(false);
  readonly showAlarm = input(true);
  readonly showObsolete = input(true);
  readonly fetchRepost = input(true);
  readonly copied = output<string>();

  readonly repostRef = toSignal(toObservable(computed(() =>
    this.ref() && this.fetchRepost() && this.repost() ? this.url() : undefined,
  )).pipe(switchMap(url => !url ? of(undefined) :
    (this.store.view.top()?.url === url ? of(this.store.view.top()) : this.refs.getCurrent(url)).pipe(
      catchError(() => of(undefined)),
      startWith(undefined),
    ))), { initialValue: undefined });
  editForm: UntypedFormGroup;
  protected readonly editFormValid = controlState(() => this.editForm, c => c.valid);
  protected readonly editFormDirty = controlState(() => this.editForm, c => c.dirty);
  readonly submitted = linkedSignal(() => { this.ref(); return false; });
  readonly invalid = linkedSignal(() => { this.ref(); return false; });
  readonly overwritten = linkedSignal(() => { this.ref(); return false; });
  readonly overwrite = linkedSignal(() => { this.ref(); return false; });
  private readonly fieldRef = computed(() => this.editing()
    ? { ...this.ref(), ...this.controlState0() } : this.ref());
  readonly expandPlugins = computed(() => this.bareRepost() && this.repostRef()
    ? this.admin.getEmbeds(this.repostRef())
    : [...this.admin.getEmbeds(this.ref()), ...(this.repostRef() ? ['plugin/repost'] : [])]);
  readonly icons = computed(() => {
    const ref = this.fieldRef();
    return uniqueConfigs(sortOrder(this.admin.getIcons(ref.tags, ref.plugins, getScheme(ref.url))));
  });
  readonly alarm = computed(() => capturesAny(this.store.account.alarms(), this.fieldRef().tags));
  readonly actions = computed(() => {
    const ref = this.fieldRef();
    return ref.created ? uniqueConfigs(sortOrder(this.admin.getActions(ref.tags, ref.plugins))) : [];
  });
  readonly groupedActions = computed(() => groupBy(this.actions().filter(a => this.showAction(a)), a => (a as any)[this.label(a)]));
  readonly advancedActions = computed(() => {
    const ref = this.fieldRef();
    return ref.created ? sortOrder(this.admin.getAdvancedActions(ref.tags, ref.plugins)) : [];
  });
  readonly groupedAdvancedActions = computed(() => groupBy(this.advancedActions().filter(a => this.showAction(a)), a => (a as any)[this.label(a)]));
  readonly infoUis = computed(() => this.admin.getPluginInfoUis(this.fieldRef().tags));
  readonly deleted = linkedSignal(() => { this.ref(); return false; });
  readonly mobileUnlock = signal(false);
  readonly storyboardLoaded = linkedSignal(() => { this.storyboardRawUrl(); return false; });
  readonly actionsExpanded = signal<boolean | undefined>(undefined);
  readonly replying = signal(false);
  readonly writeAccess = computed(() => this.auth.writeAccess(this.ref()));
  readonly taggingAccess = computed(() => this.auth.taggingAccess(this.ref()));
  readonly deleteAccess = computed(() => this.auth.deleteAccess(this.ref()));
  readonly serverError = linkedSignal<string[]>(() => { this.ref(); return []; });
  readonly publishChanged = signal(false);
  readonly diffOriginal = signal<Ref | undefined>(undefined);
  readonly diffModified = signal<Ref | undefined>(undefined);
  readonly fullscreen = linkedSignal(() => this.ref() ? this.fullscreenRequired() : false);

  readonly submitting = signal(false);
  private submittingSubscription?: Subscription;
  private refreshTap?: () => void;
  readonly editing = linkedSignal(() => { this.ref(); return false; });
  readonly viewSource = linkedSignal(() => { this.ref(); return false; });
  readonly diffing = signal(false);
  private overwrittenModified? = '';
  private diffSubscription?: Subscription;
  private closeOffFullscreen = false;
  private focusViewer = false;
  private preloadingUrl = '';

  constructor() {
    const fb = this.fb;

    this.editForm = refForm(fb);
    effect(() => {
      if (!this.refInput()) return;
      untracked(() => this.init());
    });
    effect(() => {
      const value = this.viewer();
      untracked(() => this.handleViewer(value));
    });
    effect(() => {
      if (!this.ref()) return;
      this.storyboardRawUrl();
      untracked(() => this.preloadStoryboard());
    });
    effect(() => {
      const animation = this.storyboardAnimationData();
      if (!animation || document.getElementById(animation.styleId)) return;
      const style = document.createElement('style');
      style.id = animation.styleId;
      style.textContent = animation.keyframes;
      document.head.appendChild(style);
    });
    this.store.eventBus.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.event === 'refresh') {
        if (this.editing() || this.viewSource()) {
          // TODO: show somewhere
          console.warn('Ignoring Ref edit.');
          return;
        }
        if (this.ref()?.url && this.store.eventBus.isRef(event, this.ref())) {
          this.ref.set(event.ref!);
          this.init();
          if (this.refreshTap) {
            this.refreshTap();
            delete this.refreshTap;
          }
        }
      }
      if (this.ref()?.upload && event.event === 'refresh:uploads') {
        if (this.editing() || this.viewSource()) {
          // TODO: show somewhere
          console.warn('Ignoring Ref edit.');
          return;
        }
        this.init();
      }
      if (event.event === 'error') {
        if (this.ref()?.url && this.store.eventBus.isRef(event, this.ref())) {
          this.serverError.set(event.errors);
        }
      }
      if (event.event === 'toggle') {
        if (this.ref()?.url && this.store.eventBus.isRef(event, this.ref())) {
          this.expanded.set(!this.expanded());
        }
      }
      if (event.event === 'toggle-all-open') {
        this.expanded.set(true);
      }
      if (event.event === 'toggle-all-closed') {
        this.expanded.set(false);
      }
    });
  }

  saveChanges() {
    const reply = this.reply();
    return (!this.editing() || !this.editForm.dirty)
      && (!reply || reply.saveChanges());
  }

  init() {
    if (this.ref()?.upload) this.editForm.get('url')!.enable();
  }

  private preloadStoryboard() {
    const url = this.storyboardRawUrl();
    this.preloadingUrl = url || '';
    if (!url) return;
    this.preloadingUrl = url;
    this.imgs.getImage(url).then(() => {
      if (this.preloadingUrl === url) {
        this.storyboardLoaded.set(true);
      }
    }).catch(() => {
      // If preloading fails, storyboard-ready class is never set and hover shows original thumbnail
    });
  }


  private readonly initializeView = afterNextRender(() => {
    delay(() => {
      if (this.lastSelected()) {
        scrollTo({ left: 0, top: this.el.nativeElement.getBoundingClientRect().top - 20, behavior: 'smooth' });
      }
    }, 400);
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    if (this.lastSelected()) {
      this.store.view.clearLastSelected();
    }
  });

  unlockViewer(event: Event) {
    if (!this.config.mobile()) return;
    this.mobileUnlock.set(!this.mobileUnlock());
    event.preventDefault();
  }

  getPluginClasses() {
    if (!this.ref()) return this.css;
    const tags = this.bareRepost()
      ? uniq([...(this.ref().tags || []), ...(this.repostRef()?.tags || [])])
      : this.ref().tags;
    return this.css + ' ' + [
      ...templates(tags, 'plugin'),
      ...Object.keys(this.ref().metadata?.plugins || {}).map(p => 'response-' + p),
      ...(this.ref().metadata?.userUrls || []).map(p => 'user-response-' + p)
    ].map(t => t.replace(/[+_]/g, '').replace(/\//g, '_').replace(/\./g, '-')).join(' ');
  }

  readonly refUrlAttr = computed(() => {
    return this.ref()?.url;
  });

  readonly refOriginAttr = computed(() => {
    return this.ref()?.origin || undefined;
  });

  readonly refTitleAttr = computed(() => {
    return this.title() || undefined;
  });

  readonly refThumbnailUrlAttr = computed(() => {
    if (!this.thumbnail()) return undefined;
    return this.refThumbnailUrl() || undefined;
  });

  readonly refThumbnailColorAttr = computed(() => {
    if (!this.thumbnail()) return undefined;
    return this.refThumbnailString('color') || undefined;
  });

  readonly refThumbnailEmojiAttr = computed(() => {
    if (!this.thumbnail()) return undefined;
    return this.refThumbnailString('emoji') || this.thumbnailEmojiDefaults() || undefined;
  });

  readonly refThumbnailRadiusAttr = computed(() => {
    if (!this.thumbnail()) return undefined;
    const radius = Number(this.refThumbnailPlugin()?.['radius']);
    return Number.isFinite(radius) ? `${radius}` : undefined;
  });

  readonly lastSelected = computed(() => {
    return this.scrollToLatest() && this.store.view.lastSelected()?.url === this.ref().url;
  });

  readonly uploadedFile = computed(() => {
    return this.ref().upload;
  });

  readonly existsFile = computed(() => {
    return this.ref().exists;
  });

  readonly modifiedFile = computed(() => {
    return this.ref().outdated;
  });

  readonly storyboardData = computed(() => {
    this.controlState0();
    if (!this.admin.getPlugin('plugin/image')) return null;
    if (!this.admin.getPlugin('plugin/thumbnail/storyboard')) return null;
    if (this.editing()) {
      return this.editForm.value?.plugins?.['plugin/thumbnail/storyboard'] || null;
    }
    return this.ref()?.plugins?.['plugin/thumbnail/storyboard']
      || this.repostRef()?.plugins?.['plugin/thumbnail/storyboard']
      || null;
  });

  private readonly storyboardRawUrl = computed<string | null>(() => {
    const sb = this.storyboardData();
    if (!sb?.url) return null;
    const rawUrl = String(sb.url);
    const origin = this.ref()?.origin || this.repostRef()?.origin || '';
    if (rawUrl.startsWith('cache:') || this.admin.getPlugin('plugin/thumbnail')?.config?.proxy) {
      return this.proxy.getFetch(rawUrl, origin, 'storyboard');
    } else {
      return rawUrl;
    }
  });

  readonly storyboardUrl = computed<string | null>(() => {
    return storyboardUrl(this.storyboardRawUrl());
  });

  readonly storyboardSize = computed<string | null>(() => {
    return storyboardSize(this.storyboardData());
  });

  readonly storyboardMargin = computed<string | null>(() => {
    return storyboardMargin(this.storyboardData());
  });

  readonly storyboardWidth = computed<string | null>(() => {
    return storyboardWidth(this.storyboardData());
  });

  readonly storyboardHeight = computed<string | null>(() => {
    return storyboardHeight(this.storyboardData());
  });

  private readonly storyboardAnimationData = computed(() => storyboardAnimation(this.storyboardData()));
  readonly storyboardAnimation = computed(() => this.storyboardAnimationData()?.value || null);

  readonly obsoleteOrigin = computed(() => {
    if (this.ref().metadata?.obsolete) return this.ref().origin;
    return undefined;
  });

  readonly fullscreenRequired = computed(() => {
    if (!this.admin.getPlugin('plugin/fullscreen')) return false;
    if (!hasTag('plugin/fullscreen', this.currentTags())) return false;
    return !this.ref().plugins?.['plugin/fullscreen']?.optional;
  });

  readonly pipRequired = computed(() => {
    if (!this.admin.pip()) return false;
    return hasTag('plugin/pip', this.currentTags());
  });

  onFullscreenChange() {
    if (!this.fullscreen()) return;
    if (document.fullscreenElement) return;
    this.fullscreen.set(this.fullscreenRequired());
    if (this.closeOffFullscreen) this.expanded.set(false);
  }

  onClick() {
    this.store.view.clearLastSelected(this.ref().url);
  }

  private handleViewer(value: ViewerComponent | undefined) {
    if (value) {
      if (this.fullscreen()) {
        value.el.nativeElement.requestFullscreen().catch((err: TypeError) => {
          console.warn('Could not make fullscreen.');
          if (this.closeOffFullscreen) this.expanded.set(false);
        });
      }
      if (this.focusViewer) {
        this.focusViewer = false;
        // Defer to ensure the viewer's DOM is fully rendered before focusing
        defer(() => value.el.nativeElement.focus({ preventScroll: true }));
      }
    }
  }

  setViewSource(value: boolean) {
    if (this.viewSource() === value) return;
    this.viewSource.set(value);
    if (value) {
      this.syncEditor();
    } else {
      if (this.expanded()) this.focusViewer = true;
    }
  }

  setDiffing(value: boolean) {
    if (this.diffing() === value) return;
    this.diffing.set(value);
    if (value) {
      this.diff()
    }
  }

  setEditing(value: boolean) {
    if (this.editing() === value) return;
    this.editing.set(value);
    if (value) {
      this.syncEditor();
    } else {
      if (this.expanded()) this.focusViewer = true;
      defer(() => {
        this.init();
      });
    }
  }

  syncEditor() {
    if (!this.editing() && !this.viewSource()) return;
    const refFormValue = this.refForm();
    if (refFormValue) {
      refFormValue.setRef(cloneDeep(this.ref()));
      if (this.editing()) this.editor.syncEditor(this.fb, this.editForm, this.ref().comment);
    } else {
      defer(() => this.syncEditor());
    }
  }

  readonly local = computed(() => {
    return this.ref().origin === this.store.account.origin();
  });

  readonly localhost = computed(() => {
    return this.ref().url.startsWith(this.config.base);
  });

  readonly repost = computed(() => {
    return this.ref()?.sources?.[0] && hasTag('plugin/repost', this.ref());
  });

  readonly bareRepost = computed(() => {
    return this.repost() && !this.ref().title && !this.ref().comment;
  });

  readonly currentRef = computed(() => {
    return this.repost() ? this.repostRef() : this.ref();
  });

  readonly currentTags = computed(() => {
    return uniq([...(this.repost() ? this.repostRef()?.tags : this.ref().tags) || [], ...this.expandPlugins()]);
  });

  readonly viewerEmbeds = computed(() => {
    const plugins = this.plugins();
    if (!plugins) return this.expandPlugins();
    return this.expandPlugins().filter(p => plugins.some(t => hasTag(t, [p])));
  });

  readonly bareRef = computed(() => {
    return this.bareRepost() ? this.repostRef() : this.ref();
  });

  readonly commentNoTitle = computed(() => {
    if (this.altText()) return false;
    return this.bareRef()?.title && this.bareRef()?.comment || hasComment(this.bareRef()?.comment || '');
  });

  readonly feed = computed(() => {
    return !!this.admin.getPlugin('plugin/script/feed') && hasTag('plugin/script/feed', this.ref());
  });

  readonly thread = computed(() => {
    return !!this.admin.getPlugin('plugin/thread') && hasTag('plugin/thread', this.ref());
  });

  readonly comment = computed(() => {
    return !!this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', this.ref());
  });

  readonly dm = computed(() => {
    return !!this.admin.getTemplate('dm') && hasTag('dm', this.ref());
  });

  readonly email = computed(() => {
    return !!this.admin.getTemplate('email') && hasTag('email', this.ref());
  });

  readonly remote = computed(() => {
    return !!this.admin.getPlugin('+plugin/origin') && hasTag('+plugin/origin', this.ref());
  });

  readonly originPull = computed(() => {
    return !!this.admin.getPlugin('+plugin/origin/pull') && hasTag('+plugin/origin/pull', this.ref());
  });

  readonly originPush = computed(() => {
    return !!this.admin.getPlugin('+plugin/origin/push') && hasTag('+plugin/origin/push', this.ref());
  });

  readonly localOrigin = computed(() => {
    if (this.originPull() || this.originPush()) {
      return this.ref().plugins?.['+plugin/origin']?.local && subOrigin(this.ref().origin, this.ref().plugins?.['+plugin/origin']?.local);
    }
    return undefined;
  });

  readonly remoteOrigin = computed(() => {
    if (this.originPull() || this.originPush()) {
      return this.ref().plugins?.['+plugin/origin']?.remote;
    }
    return undefined;
  });

  readonly thumbnail = computed(() => {
    this.controlState0();
    if (!this.admin.getPlugin('plugin/thumbnail')) return false;
    if (this.editing()) {
      if (hasTag('plugin/thumbnail', this.editForm.value)) return true;
      if (!this.admin.getPlugin('plugin/image')) return false;
      return hasTag('plugin/image', this.editForm.value);
    }
    if (hasTag('plugin/thumbnail', this.ref()) || hasTag('plugin/thumbnail', this.repostRef())) return true;
    if (!this.admin.getPlugin('plugin/image')) return false;
    return hasTag('plugin/image', this.ref()) || hasTag('plugin/image', this.repostRef());
  });

  readonly thumbnailRefs = computed(() => {
    this.controlState0();
    return this.editing() ? [{ ...this.editForm.getRawValue(), origin: this.ref().origin }] : [this.repostRef(), this.ref()];
  });

  readonly refThumbnailPlugin = computed(() => {
    const plugin = this.ref()?.plugins?.['plugin/thumbnail'] || this.repostRef()?.plugins?.['plugin/thumbnail'];
    return plugin && typeof plugin === 'object' && !Array.isArray(plugin) ? plugin : undefined;
  });

  refThumbnailString(key: 'url' | 'color' | 'emoji') {
    const value = this.refThumbnailPlugin()?.[key];
    return typeof value === 'string' ? value : '';
  }

  refThumbnailUrl() {
    const url = this.refThumbnailString('url');
    if (!this.admin.getPlugin('plugin/image')) return isInlineSvg(url) ? url : '';
    return url || this.refThumbnailPluginUrl('plugin/image') || this.refThumbnailPluginUrl('plugin/video');
  }

  refThumbnailPluginUrl(plugin: 'plugin/image' | 'plugin/video') {
    const value = this.ref()?.plugins?.[plugin]?.url || this.repostRef()?.plugins?.[plugin]?.url;
    return typeof value === 'string' ? value : '';
  }

  readonly thumbnailColor = computed(() => {
    this.controlState0();
    if (!this.thumbnail()) return '';
    if (this.editing()) return this.editForm.value.plugins?.['plugin/thumbnail']?.color || '';
    return this.ref()?.plugins?.['plugin/thumbnail']?.color || this.repostRef()?.plugins?.['plugin/thumbnail']?.color || '';
  });

  readonly thumbnailEmoji = computed(() => {
    this.controlState0();
    if (!this.thumbnail()) return '';
    if (this.editing()) return this.editForm.value.plugins?.['plugin/thumbnail']?.emoji || '';
    return this.ref()?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef()?.plugins?.['plugin/thumbnail']?.emoji || '';
  });

  readonly thumbnailEmojiDefaults = computed(() => {
    const icon = this.icons().filter(i => i.thumbnail || (i.label && (i.order || 0) >= 0) && this.showIcon(i))[0];
    return icon?.label || icon?.thumbnail;
  });

  readonly thumbnailRadius = computed(() => {
    this.controlState0();
    if (this.editing()) return this.editForm.value.plugins?.['plugin/thumbnail']?.radius || 0;
    return this.ref()?.plugins?.['plugin/thumbnail']?.radius || this.repostRef()?.plugins?.['plugin/thumbnail']?.radius || 0;
  });

  readonly file = computed(() => {
    return this.admin.getPlugin('plugin/file') &&
      hasTag('plugin/file', this.currentRef());
  });

  readonly audio = computed(() => {
    return this.admin.getPlugin('plugin/audio') &&
      hasTag('plugin/audio', this.currentRef()) &&
      (this.ref()?.plugins?.['plugin/audio']?.url || this.url());
  });

  readonly video = computed(() => {
    return this.admin.getPlugin('plugin/video') &&
      hasTag('plugin/video', this.currentRef()) &&
      (this.ref()?.plugins?.['plugin/video']?.url || this.url());
  });

  readonly image = computed(() => {
    return this.admin.getPlugin('plugin/image') &&
      hasTag('plugin/image', this.currentRef()) &&
      (this.ref()?.plugins?.['plugin/image']?.url || this.url());
  });

  getFilename(d = $localize`Untitled`) {
    const ext = getExtension(this.url()) || '';
    const filename = this.ref()?.title || d;
    return filename + (ext && !filename.toLowerCase().endsWith(ext) ? ext : '');
  }

  readonly mediaAttachment = computed(() => {
    if (this.file()) {
      return this.proxy.getFetch(this.url(), this.origin(), this.getFilename());
    }
    if (this.audio() && (this.audio().startsWith('cache:') || this.admin.getPlugin('plugin/audio')?.config?.proxy)) {
      return this.proxy.getFetch(this.audio(), this.origin(), this.getFilename($localize`Untitled Audio`));
    }
    if (this.video() && (this.video().startsWith('cache:') || this.admin.getPlugin('plugin/video')?.config?.proxy)) {
      return this.proxy.getFetch(this.video(), this.origin(), this.getFilename($localize`Untitled Video`));
    }
    if (this.image() && (this.image().startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy)) {
      return this.proxy.getFetch(this.image(), this.origin(), this.getFilename($localize`Untitled Image`));
    }
    return '';
  });

  readonly canInvoice = computed(() => {
    if (!this.local()) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor()) return false;
    return hasTag('queue', this.ref());
  });

  readonly isAuthor = computed(() => {
    return isAuthorTag(this.store.account.tag(), this.ref());
  });

  readonly isRecipient = computed(() => {
    return hasTag(this.store.account.mailbox(), this.ref());
  });

  readonly authors = computed(() => {
    const lookup = this.store.origins.originMap().get(this.ref().origin || '');
    return uniq([
      ...this.ref().tags?.filter(t => this.admin.getPlugin(t)?.config?.signature === t) || [],
      ...authors(this.ref()).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  });

  readonly authorExts = toSignal(toObservable(computed(() =>
    [this.authors(), this.ref().origin || ''] as const)).pipe(
    switchMap(([tags, origin]) => this.exts.getCachedExts(tags, origin).pipe(this.admin.authorFallback)),
  ), { initialValue: [] });

  readonly recipients = computed(() => {
    const lookup = this.store.origins.originMap().get(this.ref().origin || '');
    const userRecipients = without(addressedTo(this.ref()), ...this.authors()).map(a => {
      if (!tagOrigin(a)) return a;
      return localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a));
    });
    return [
      ...userRecipients,
      ...this.ref().tags?.filter(t => this.admin.getPlugin(t)?.config?.signature && this.admin.getPlugin(t)?.config?.signature != t) || [],
    ];
  });

  readonly recipientExts = toSignal(toObservable(computed(() =>
    [this.recipients(), this.ref().origin || ''] as const)).pipe(
    switchMap(([tags, origin]) => this.exts.getCachedExts(tags, origin).pipe(this.admin.recipientFallback)),
  ), { initialValue: [] });

  readonly mailboxes = computed(() => {
    return mailboxes(this.ref(), this.store.account.tag(), this.store.origins.originMap());
  });

  readonly replySources = computed(() => {
    const sources = [this.ref().url];
    if (this.comment() || this.thread() || this.email()) {
      const refSources = this.ref().sources;
      if (refSources?.length) {
        sources.push(refSources[1] || refSources[0] || this.ref().url);
      }
    }
    return sources;
  });

  readonly replyTags = computed<string[]>(() => {
    const tags = [
      ...this.admin.reply().filter(p => hasTag(p.tag, this.ref())).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes(),
    ];
    return removeTag(getMailbox(this.store.account.tag(), this.store.account.origin()), uniq(tags));
  });

  readonly replyTo = computed(() => {
    return this.authors().join(' ')
  });

  readonly tags = computed(() => {
    return interestingTags(this.ref().tags);
  });

  readonly tagExts = toSignal(toObservable(computed(() =>
    [this.tags(), this.ref().origin || ''] as const)).pipe(
    switchMap(([tags, origin]) => this.editor.getTagsPreview(tags, origin)),
  ), { initialValue: [] });

  readonly url = computed(() => {
    return this.repost() ? this.ref().sources![0] : this.ref().url;
  });

  readonly origin = computed(() => {
    return this.bareRef()?.origin;
  });

  readonly link = computed(() => {
    if (this.file() || this.url().startsWith('cache:')) return this.proxy.getFetch(this.url(), this.origin(), this.getFilename());
    return this.url();
  });

  readonly title = computed(() => {
    this.controlState0();
    if (this.editing()) return getTitle(this.editForm.value);
    if (this.bareRepost()) return getTitle(this.repostRef()) || $localize`Repost`;
    return getTitle(this.ref());
  });

  readonly defaultView = computed(() => {
    if (this.thread() || this.threads() || this.dm()) return 'thread';
    if (this.comment()) return 'comments';
    return undefined;
  });

  readonly host = computed(() => {
    return urlSummary(this.url());
  });

  readonly tagLink = computed(() => {
    return this.url().toLowerCase().startsWith('tag:/');
  });

  readonly editingLink = computed(() => {
    if (!hasTag('plugin/editing', this.ref())) return undefined;
    if (this.url().startsWith('comment:')) {
      return { routerLink: ['/submit/text'], queryParams: { url: this.url() } };
    }
    return { routerLink: ['/submit/web'], queryParams: { url: this.url() } };
  });

  readonly submitRoute = computed(() => {
    if (this.url().startsWith('comment:')) {
      return { routerLink: ['/submit/text'], queryParams: { url: this.url() } };
    }
    return { routerLink: ['/submit/web'], queryParams: { url: this.url() } };
  });

  readonly clickableLink = computed(() => {
    if (this.file()) return true;
    return clickableLink(this.url());
  });

  readonly redundantLink = computed(() => {
    if (this.editingLink()) return true;
    if (!this.clickableLink()) return true;
    return this.expandPlugins().length;
  });

  readonly altText = computed(() => {
    if (this.ref()?.tags?.includes('plugin/alt') || this.tags()?.includes('plugin/alt')) {
      return this.bareRef()?.comment;
    }
    return undefined;
  });

  readonly comments = computed(() => {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref().metadata?.plugins?.['plugin/comment'] || 0;
  });

  readonly newCommentsCount = computed(() => {
    const lastSeen = this.store.local.getLastSeenCount(this.ref().url, 'comments');
    if (!lastSeen) return 0;
    return Math.max(0, this.comments() - lastSeen);
  });

  readonly errors = computed(() => {
    if (!this.admin.getPlugin('+plugin/log')) return 0;
    return this.ref().metadata?.plugins?.['+plugin/log'] || 0;
  });

  readonly threads = computed(() => {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.ref().metadata?.plugins?.['plugin/thread'] || 0;
  });

  readonly newThreadsCount = computed(() => {
    const lastSeen = this.store.local.getLastSeenCount(this.ref().url, 'threads');
    if (!lastSeen) return 0;
    return Math.max(0,  this.threads() - lastSeen);
  });

  readonly responses = computed(() => {
    return this.ref().metadata?.responses || 0;
  });

  readonly newResponsesCount = computed(() => {
    const lastSeen = this.store.local.getLastSeenCount(this.ref().url, 'replies');
    if (!lastSeen) return 0;
    return Math.max(0, this.responses() - lastSeen);
  });

  readonly sources = computed(() => {
    const sources = uniq(this.ref()?.sources).filter(s => s != this.ref().url);
    return sources.length || 0;
  });

  readonly top = computed(() => {
    return top(this.ref());
  });

  readonly parent = computed(() => {
    const sources = uniq(this.ref().sources).filter(s => s != this.ref().url);
    if (sources.length === 1) return sources[0];
    return false;
  });

  readonly parentComment = computed(() => {
    if (!hasTag('plugin/comment', this.ref())) return false;
    if (this.ref().sources?.[0] === this.ref().url) return false;
    if (this.ref().sources?.[1] === this.ref().url) return false;
    if (this.sources() === 1 || this.sources() === 2) return this.ref().sources![0];
    return false;
  });

  readonly parentCommentTop = computed(() => {
    if (!hasTag('plugin/comment', this.ref())) return false;
    if (this.ref().sources?.[0] === this.ref().url) return false;
    if (this.ref().sources?.[1] === this.ref().url) return false;
    if (this.sources() === 2) return this.ref().sources![1];
    return false;
  });

  readonly parentThreadTop = computed(() => {
    if (!hasTag('plugin/thread', this.ref())) return false;
    if (this.ref().sources?.[0] === this.ref().url) return false;
    if (this.ref().sources?.[1] === this.ref().url) return false;
    if (this.sources() === 2) return this.ref().sources![1];
    if (this.sources() === 1) return this.ref().sources![0];
    return false;
  });

  readonly publishedIsSubmitted = computed(() => {
    const ref = this.ref();
    return !ref.published || Math.abs(ref.published.diff(ref.created!, 'seconds').seconds) <= 5;
  });

  readonly modifiedIsSubmitted = computed(() => {
    const ref = this.ref();
    return !ref.modified || Math.abs(ref.modified.diff(ref.created!, 'seconds').seconds) <= 5;
  });

  readonly upvote = computed(() => {
    return hasUserUrlResponse('plugin/user/vote/up', this.ref());
  });

  readonly downvote = computed(() => {
    return hasUserUrlResponse('plugin/user/vote/down', this.ref());
  });

  readonly isView = computed(() => {
    return isRef(this.ref(), this.store.view.ref());
  });

  toggle() {
    let read = false;
    if (this.editing()) {
      this.setEditing(false);
    } else if (this.viewSource()) {
      this.setViewSource(false);
    } else if (!this.fullscreen()) {
      if (this.store.hotkey() && this.admin.getPlugin('plugin/fullscreen')) {
        this.fullscreen.set(true);
        this.closeOffFullscreen = !this.expanded();
        const viewer = this.viewer();
        if (viewer) {
          viewer.el.nativeElement.requestFullscreen().catch(() => {
            console.warn('Could not make fullscreen.');
          });
        }
        this.focusViewer = true;
        this.expanded.set(true);
      } else if (this.pipRequired()) {
        this.store.eventBus.fire('pip', this.ref());
        read = true;
      } else {
        this.expanded.set(!this.expanded());
        if (this.expanded()) this.focusViewer = true;
        this.store.local.setRefToggled(this.ref().url, this.expanded());
      }
      // Mark as read
      if (!read && !this.expanded()) return;
      this.markRead();
    }
  }

  pip(event?: MouseEvent) {
    if (!this.admin.pip()) return;
    this.store.eventBus.fire('pip', this.ref());
    this.markRead();
    if ('vibrate' in navigator) navigator.vibrate([2, 32, 4]);
    event?.preventDefault();
    event?.stopPropagation();
  }

  markRead() {
    markRead(this.admin, this.ts, this.ref());
  }

  readonly infoUiMarkdowns = computed(() => this.infoUis().map(ui => {
    const plugin = this.admin.getPlugin(ui.tag)!;
    return { tag: ui.tag, text: hydrate(plugin.config, 'infoUi', getPluginScope(plugin, this.ref())) };
  }));

  saveRef() {
    this.store.view.preloadRef(this.ref(), this.repostRef());
  }

  formatAuthor(user: string) {
    return formatAuthor(user);
  }

  tag$ = (tag: string) => {
    if (this.ref().upload) {
      let tags = this.ref().tags || [];
      for (const t of tag.split(' ').filter(t => !!t.trim())) {
        if (t.startsWith('-')) {
          tags = tags.filter(r => expandedTagsInclude(r, t.substring(1)));
        } else if (!hasTag(t, { ...this.ref(), tags })) {
          tags = [...tags, t];
        }
      }
      this.ref.update(r => ({ ...r, tags }));
      this.init();
      return of(null);
    } else {
      return this.store.eventBus.runAndReload$(this.ts.create(tag, this.ref().url, this.ref().origin!).pipe(
        tap(cursor => this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor))),
      ), this.ref());
    }
  }

  label(a: Action) {
    if ('tag' in a || 'response' in a) {
      return active(this.ref(), a) ? 'labelOn' : 'labelOff';
    }
    return 'label';
  }

  showIcon(i: Icon) {
    return visible(this.ref(), i, this.isAuthor(), this.isRecipient()) && active(this.ref(), i);
  }

  clickIcon(i: Icon, ctrl: boolean) {
    if (i.anyResponse) {
      this.bookmarks.toggleFilter(i.anyResponse);
    }
    if (i.tag) {
      this.bookmarks.toggleFilter((ctrl ? `query/!(${i.tag})` : `query/${i.tag}`));
    }
    if (i.scheme) {
      this.bookmarks.toggleFilter(`scheme/${i.scheme}`);
    }
  }

  showAction(a: Action) {
    if (!visible(this.ref(), a, this.isAuthor(), this.isRecipient())) return false;
    if ('scheme' in a) {
      if (a.scheme !== getScheme(this.repostRef()?.url || this.ref().url)) return false;
    }
    if ('tag' in a) {
      if (a.tag === 'locked' && !this.writeAccess()) return false;
      if (a.tag && !this.taggingAccess()) return false;
      if (a.tag && !hasTag(a.tag, this.ref()) && !this.auth.canAddTag(a.tag)) return false;
      if (a.tag && hasTag(a.tag, this.ref()) && !this.writeAccess()) return false;
    }
    if ('tag' in a || 'response' in a) {
      if (!this.auth.hasRole('ROLE_USER')) return false;
      if (active(this.ref(), a) && !a.labelOn) return false;
      if (!active(this.ref(), a) && !a.labelOff) return false;
    } else {
      if (!a.label) return false;
    }
    return true;
  }

  voteUp() {
    const ref = this.ref();
    let userUrls = ref.metadata?.userUrls || [];
    let request: Observable<any>;
    if (this.upvote()) {
      userUrls = without(userUrls, 'plugin/user/vote/up');
      request = this.ts.deleteResponse('plugin/user/vote/up', ref.url);
    } else if (!this.downvote()) {
      userUrls = [...userUrls, 'plugin/user/vote/up'];
      request = this.ts.createResponse('plugin/user/vote/up', ref.url);
    } else {
      userUrls = without([...userUrls, 'plugin/user/vote/up'], 'plugin/user/vote/down');
      request = this.ts.respond(['plugin/user/vote/up', '-plugin/user/vote/down'], ref.url);
    }
    const updated = { ...ref, metadata: { ...ref.metadata, userUrls } };
    this.ref.set(updated);
    this.store.eventBus.runAndRefresh(request, updated);
  }

  voteDown() {
    const ref = this.ref();
    let userUrls = ref.metadata?.userUrls || [];
    let request: Observable<any>;
    if (this.downvote()) {
      userUrls = without(userUrls, 'plugin/user/vote/down');
      request = this.ts.deleteResponse('plugin/user/vote/down', ref.url);
    } else if (!this.upvote()) {
      userUrls = [...userUrls, 'plugin/user/vote/down'];
      request = this.ts.createResponse('plugin/user/vote/down', ref.url);
    } else {
      userUrls = without([...userUrls, 'plugin/user/vote/down'], 'plugin/user/vote/up');
      request = this.ts.respond(['-plugin/user/vote/up', 'plugin/user/vote/down'], ref.url);
    }
    const updated = { ...ref, metadata: { ...ref.metadata, userUrls } };
    this.ref.set(updated);
    this.store.eventBus.runAndRefresh(request, updated);
  }

  save() {
    this.submitted.set(true);
    this.editForm.markAllAsTouched();
    this.editor.syncEditor(this.fb, this.editForm);
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = this.editForm.value.published ? DateTime.fromISO(this.editForm.value.published) : this.ref().published;
    let ref = {
      ...this.editForm.value,
      published,
      plugins: writePlugins(this.editForm.value.tags, this.editForm.value.plugins),
      modifiedString: this.overwrite() ? this.overwrittenModified : this.ref().modifiedString,
    };
    ref = {
      ...this.ref(),
      ...ref,
      plugins: writePlugins(this.editForm.value.tags, {
        ...this.ref().plugins,
        ...ref.plugins,
      }),
    };
    if (this.ref().upload) {
      ref.upload = true;
      if (ref.url !== this.ref().url) delete ref.exists;
      this.store.submit.setRef(ref, this.ref().url);
      this.editForm.reset();
      this.init();
    } else {
      this.refreshTap = () => this.publishChanged.set(+published! !== +this.ref().published!);
      this.submitting.set(true);
    this.submittingSubscription = this.store.eventBus.runAndReload(this.refs.update(ref).pipe(
        tap(cursor => {
          this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor));
          this.editForm.reset();
          this.submitting.set(false);
          this.setEditing(false);
          }),
        catchError((res: HttpErrorResponse) => {
          this.submitting.set(false);
          if (res.status === 400) {
            this.invalid.set(true);
            console.log(res.message);
            // TODO: read res.message to find which fields to delete
          }
          if (res.status === 409) {
            this.overwritten.set(true);
            this.refs.get(this.ref().url, this.ref().origin).subscribe(x => {
              this.overwrittenModified = x.modifiedString;
                  });
          }
            return throwError(() => res);
        }),
      ), ref);
    this.submittingSubscription?.add(() => this.submitting.set(false));
    }
  }

  copy$ = () => {
    const tags = uniq([
      ...(this.store.account.localTag() ? [this.store.account.localTag()] : []),
      ...(this.ref().tags || [])
        .filter(t => hasPrefix(t, 'plugin') || !t.startsWith('+') && !t.startsWith('_'))
        .filter(t => !hasPrefix(t, 'user'))
        .filter(t => this.auth.canAddTag(t))
    ]);
    const copied: Ref = {
      ...this.ref(),
      origin: this.store.account.origin(),
      tags,
    };
    copied.plugins = pick(copied.plugins, tags || []);
    if (hasTag('+plugin/origin', copied)) {
      copied.plugins['+plugin/origin'].local = copied.plugins['+plugin/origin'].remote = subOrigin(this.ref().origin, copied.plugins['+plugin/origin'].local);
      copied.plugins['+plugin/origin'].proxy = this.store.origins.lookup().get(this.ref().origin || '');
    }
    if (hasTag('+plugin/origin/tunnel', copied)) {
      copied.plugins['+plugin/origin/tunnel'] = this.store.origins.tunnelLookup().get(this.ref().origin || '');
    }
    return this.refs.create(copied).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.refs.get(this.ref().url, this.store.account.origin()).pipe(
            switchMap(existing => {
              if (equalsRef(existing, copied) || confirm('An old version already exists. Overwrite it?')) {
                return this.refs.update({ ...copied, modifiedString: existing.modifiedString });
              } else {
                return throwError(() => 'Cancelled');
              }
            })
          );
        }
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.ref().url, this.store.account.origin())),
      tap(ref => {
        this.ref.set(ref);
        this.init();
      })
    );
  }

  diff() {
    // Fetch obsolete versions and show diff with most recent remote version
    this.diffSubscription?.unsubscribe();
    this.diffSubscription = this.refs.page({
      url: this.ref().url,
      query: `!${this.store.account.origin() || '*'}`,
      obsolete: null,
      size: 1,
      sort: ['modified,DESC']
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      map(page => {
        // Find the most recent remote version (not from local origin)
        const remoteVersion = page.content.find(r => r.origin !== this.store.account.origin());
        if (!remoteVersion) {
          throw new Error('No remote version found');
        }
        return remoteVersion;
      }),
      switchMap(remoteVersion =>
        this.refs.get(this.ref().url, this.store.account.origin()).pipe(
          map(localVersion => ({ local: localVersion, remote: remoteVersion }))
        )
      ),
      catchError(err => {
        console.error('Error fetching versions for diff:', err);
        alert('Could not load versions for comparison');
        return throwError(() => err);
      })
    ).subscribe(({ local, remote }) => {
      this.diffOriginal.set(remote);
      this.diffModified.set(local);
      this.setDiffing(true);
    });
  }

  saveDiff() {
    const ref = this.diffEditor()?.getModifiedContent();
    if (!ref) return;
    ref.origin = this.store.account.origin();
    ref.modifiedString = this.overwrite() ? this.overwrittenModified : this.ref().modifiedString;
    this.submitting.set(true);
    this.submittingSubscription = this.store.eventBus.runAndReload(this.refs.update(ref).pipe(
      tap(cursor => {
        this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor));
        this.submitting.set(false);
        this.setDiffing(false);
      }),
      catchError((res: HttpErrorResponse) => {
        this.submitting.set(false);
        if (res.status === 400) {
          this.invalid.set(true);
          console.error('Invalid ref data:', res.message);
          // TODO: read res.message to find which fields to delete
        }
        if (res.status === 409) {
          this.overwritten.set(true);
          this.refs.get(this.ref().url, this.ref().origin).subscribe(x => {
            this.overwrittenModified = x.modifiedString;
              });
        }
        return throwError(() => res);
      }),
    ), ref);
    this.submittingSubscription?.add(() => this.submitting.set(false));
  }

  upload$ = () => {
    const original = this.ref();
    return this.store.eventBus.catchError$(this.uploadCache.restore$(original, this.store.account.origin()), original).pipe(
      switchMap((restored: Ref) => {
        const ref: Ref = {
          ...restored,
          origin: this.store.account.origin(),
          tags: restored.tags?.filter(t => this.auth.canAddTag(t)),
        };
        ref.plugins = pick(ref.plugins, ref.tags || []);
        return this.store.eventBus.runAndReload$(
          (this.store.submit.overwrite() || ref.url !== original.url
            ? this.refs.update(ref)
            : this.refs.create(ref).pipe(
              catchError((err: HttpErrorResponse) => {
                if (err.status === 409) {
                  return this.refs.get(ref.url, this.store.account.origin()).pipe(
                    switchMap(existing => {
                      if (+existing.modified! === +ref.modified! || equalsRef(existing, ref) || confirm('An old version already exists. Overwrite it?')) {
                        // TODO: Show diff and merge or split
                        return this.refs.update({ ...ref, modifiedString: existing.modifiedString });
                      } else {
                        return throwError(() => 'Cancelled');
                      }
                    })
                  );
                }
                return throwError(() => err);
              }),
            )).pipe(
            tap(() => {
              this.store.submit.removeRef(original);
              if (!this.store.submit.refs().length && !this.store.submit.exts().length) {
                this.router.navigate(['/ref', ref.url]);
              }
            }),
          ), ref);
      }),
    );
  }

  forceDelete$ = () => {
    this.serverError.set([]);
    return this.refs.delete(this.ref().url, this.ref().origin).pipe(
      tap(() => this.deleted.set(true)),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    this.serverError.set([]);
    return (this.local() && hasTag('locked', this.ref())
        ? this.ts.patch(['plugin/delete', 'internal'], this.ref().url, this.ref().origin)
        : this.local() && !hasTag('plugin/delete', this.ref()) && this.admin.getPlugin('plugin/delete')
          ? this.refs.update(deleteNotice(this.ref()))
          : this.refs.delete(this.ref().url, this.ref().origin).pipe(map(() => ''))
    ).pipe(
      tap((cursor: string) => {
        this.deleted.set(true);
        if (this.store.account.mod && cursor) {
          this.store.eventBus.reload(this.ref());
        }
      }),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

  remove$ = () => {
    this.serverError.set([]);
    this.store.submit.removeRef(this.ref());
    this.deleted.set(true);
    return of(null);
  }

  delayLastSelected() {
    delay(() => this.store.view.setLastSelected(this.ref()), 200);
  }

  onReply(ref?: Ref) {
    this.replying.set(false);
    if (!ref) return;
    this.store.eventBus.reload(this.ref());
  }
}
