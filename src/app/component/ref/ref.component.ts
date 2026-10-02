import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
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
  viewChildren,
  viewChild,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { cloneDeep, defer, delay, groupBy, pick, throttle, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, map, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { TitleDirective } from '../../directive/title.directive';
import { DiffComponent } from '../../form/diff/diff.component';
import { writePlugins } from '../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { getPluginScope, Plugin } from '../../model/plugin';
import { equalsRef, isRef, Ref } from '../../model/ref';
import { Action, active, hydrate, Icon, sortOrder, uniqueConfigs, visible } from '../../model/tag';
import { deleteNotice } from '../../mods/delete';
import { addressedTo, getMailbox, mailboxes } from '../../mods/mailbox';
import { CssUrlPipe } from '../../pipe/css-url.pipe';
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
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
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
  repost,
  subOrigin,
  tagOrigin,
  top
} from '../../util/tag';
import { ActionListComponent } from '../action/action-list/action-list.component';
import { ActionComponent } from '../action/action.component';
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
    '[class.mobile-unlock]': 'mobileUnlock()',
    '[class.storyboard-ready]': 'storyboardLoaded()',
    '[attr.data-ref-url]': 'refUrlAttr',
    '[attr.data-ref-origin]': 'refOriginAttr',
    '[attr.data-ref-title]': 'refTitleAttr',
    '[attr.data-ref-thumbnail-url]': 'refThumbnailUrlAttr',
    '[attr.data-ref-thumbnail-color]': 'refThumbnailColorAttr',
    '[attr.data-ref-thumbnail-emoji]': 'refThumbnailEmojiAttr',
    '[attr.data-ref-thumbnail-radius]': 'refThumbnailRadiusAttr',
    '[class.last-selected]': 'lastSelected',
    '[class.upload]': 'uploadedFile',
    '[class.exists]': 'existsFile',
    '[class.outdated]': 'modifiedFile',
    '[class.sent]': 'isAuthor',
    '[style.--storyboard-url]': 'storyboardUrl',
    '[style.--storyboard-size]': 'storyboardSize',
    '[style.--storyboard-margin]': 'storyboardMargin',
    '[style.--storyboard-width]': 'storyboardWidth',
    '[style.--storyboard-height]': 'storyboardHeight',
    '[style.--storyboard-animation]': 'storyboardAnimation',
    '(fullscreenchange)': 'onFullscreenChange()',
    '(click)': 'onClick()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
export class RefComponent implements AfterViewInit, OnDestroy, HasChanges {

  css = 'ref list-item';
  readonly allCss = signal(this.css);
  private destroyRef = inject(DestroyRef);

  readonly actionComponents = viewChildren<ActionComponent>('action');
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

  readonly repostRef = signal<Ref | undefined>(undefined);
  editForm: UntypedFormGroup;
  readonly submitted = signal(false);
  readonly invalid = signal(false);
  readonly overwritten = signal(false);
  readonly overwrite = signal(true);
  readonly expandPlugins = signal<string[]>([]);
  readonly icons = signal<Icon[]>([]);
  readonly alarm = signal<string | undefined>(undefined);
  readonly actions = signal<Action[]>([]);
  readonly groupedActions = signal<Record<string, Action[]>>({});
  readonly advancedActions = signal<Action[]>([]);
  readonly groupedAdvancedActions = signal<Record<string, Action[]>>({});
  readonly infoUis = signal<Plugin[]>([]);
  readonly deleted = signal(false);
  readonly mobileUnlock = signal(false);
  readonly storyboardLoaded = signal(false);
  readonly actionsExpanded = signal<boolean | undefined>(undefined);
  readonly replying = signal(false);
  readonly writeAccess = signal(false);
  readonly taggingAccess = signal(false);
  readonly deleteAccess = signal(false);
  readonly serverError = signal<string[]>([]);
  readonly publishChanged = signal(false);
  readonly diffOriginal = signal<Ref | undefined>(undefined);
  readonly diffModified = signal<Ref | undefined>(undefined);
  readonly fullscreen = signal(false);

  readonly submitting = signal<Subscription | undefined>(undefined);
  private refreshTap?: () => void;
  readonly editing = signal(false);
  readonly viewSource = signal(false);
  readonly diffing = signal(false);
  private overwrittenModified? = '';
  private diffSubscription?: Subscription;
  private closeOffFullscreen = false;
  private focusViewer = false;
  private preloadingUrl = '';

  constructor(
    public config: ConfigService,
    public accounts: AccountService,
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private bookmarks: BookmarkService,
    private proxy: ProxyService,
    private ts: TaggingService,
    private router: Router,
    private fb: UntypedFormBuilder,
    private el: ElementRef<HTMLDivElement>,
    private imgs: ImageService,
  ) {
    this.editForm = refForm(fb);
    effect(() => {
      if (!this.refInput()) return;
      untracked(() => this.init());
    });
    effect(() => {
      const value = this.viewer();
      untracked(() => this.handleViewer(value));
    });
    this.editForm.valueChanges.pipe(
      takeUntilDestroyed(),
    ).subscribe(throttle(value => {
      if (!this.editing()) return;
      if (!value?.title && !value?.comment || !value?.tags?.length) return;
      defer(() => {
        // Let Formly finish rebuilding tag rows before derived Ref UI state reacts.
        this.initFields({ ...this.ref(), ...value });
      });
    }, 400, { leading: true, trailing: true }));
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
    this.serverError.set([]);
    this.submitted.set(false);
    this.invalid.set(false);
    this.overwritten.set(false);
    this.overwrite.set(false);
    this.deleted.set(false);
    this.setEditing(false);
    this.setViewSource(false);
    this.storyboardLoaded.set(false);
    this.preloadingUrl = '';
    this.actionComponents()?.forEach(c => c.reset());
    if (this.ref()?.upload) this.editForm.get('url')!.enable();
    this.writeAccess.set(this.auth.writeAccess(this.ref()));
    this.taggingAccess.set(this.auth.taggingAccess(this.ref()));
    this.deleteAccess.set(this.auth.deleteAccess(this.ref()));
    this.fullscreen.set(this.fullscreenRequired);
    this.initFields(this.ref());

    this.expandPlugins.set(this.admin.getEmbeds(this.ref()));
    if (this.repost && this.ref() && this.fetchRepost() && this.repostRef()?.url != repost(this.ref())) {
      (this.store.view.top?.url === this.ref().sources![0]
          ? of(this.store.view.top)
          : this.refs.getCurrent(this.url)
      ).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(ref => {
        this.repostRef.set(ref);
        if (!ref) return;
        if (this.bareRepost) {
          this.expandPlugins.set(this.admin.getEmbeds(ref));
          this.allCss.set(this.getPluginClasses());
        } else {
          this.expandPlugins.set([...this.expandPlugins(), 'plugin/repost']);
        }
        this.preloadStoryboard();
      });
    }
    this.preloadStoryboard();
  }

  private preloadStoryboard() {
    const url = this.storyboardRawUrl;
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

  initFields(ref: Ref) {
    this.icons.set(uniqueConfigs(sortOrder(this.admin.getIcons(ref.tags, ref.plugins, getScheme(ref.url)))));
    this.alarm.set(capturesAny(this.store.account.alarms, ref.tags));
    this.actions.set(ref.created ? uniqueConfigs(sortOrder(this.admin.getActions(ref.tags, ref.plugins))) : []);
    this.groupedActions.set(groupBy(this.actions().filter(a => this.showAction(a)), a => (a as any)[this.label(a)]));
    // TODO: detect width and move actions that don't fit into advanced actions
    this.advancedActions.set(ref.created ? sortOrder(this.admin.getAdvancedActions(ref.tags, ref.plugins)) : []);
    this.groupedAdvancedActions.set(groupBy(this.advancedActions().filter(a => this.showAction(a)), a => (a as any)[this.label(a)]));
    this.infoUis.set(this.admin.getPluginInfoUis(ref.tags));
    this.allCss.set(this.getPluginClasses())
  }

  ngAfterViewInit(): void {
    delay(() => {
      if (this.lastSelected) {
        scrollTo({ left: 0, top: this.el.nativeElement.getBoundingClientRect().top - 20, behavior: 'smooth' });
      }
    }, 400);
  }

  ngOnDestroy() {
    if (this.lastSelected) {
      this.store.view.clearLastSelected();
    }
  }

  unlockViewer(event: Event) {
    if (!this.config.mobile) return;
    this.mobileUnlock.set(!this.mobileUnlock());
    event.preventDefault();
  }

  getPluginClasses() {
    if (!this.ref()) return this.css;
    const tags = this.bareRepost
      ? uniq([...(this.ref().tags || []), ...(this.repostRef()?.tags || [])])
      : this.ref().tags;
    return this.css + ' ' + [
      ...templates(tags, 'plugin'),
      ...Object.keys(this.ref().metadata?.plugins || {}).map(p => 'response-' + p),
      ...(this.ref().metadata?.userUrls || []).map(p => 'user-response-' + p)
    ].map(t => t.replace(/[+_]/g, '').replace(/\//g, '_').replace(/\./g, '-')).join(' ');
  }

  get refUrlAttr() {
    return this.ref()?.url;
  }

  get refOriginAttr() {
    return this.ref()?.origin || undefined;
  }

  get refTitleAttr() {
    return this.title || undefined;
  }

  get refThumbnailUrlAttr() {
    if (!this.thumbnail) return undefined;
    return this.refThumbnailUrl() || undefined;
  }

  get refThumbnailColorAttr() {
    if (!this.thumbnail) return undefined;
    return this.refThumbnailString('color') || undefined;
  }

  get refThumbnailEmojiAttr() {
    if (!this.thumbnail) return undefined;
    return this.refThumbnailString('emoji') || this.thumbnailEmojiDefaults || undefined;
  }

  get refThumbnailRadiusAttr() {
    if (!this.thumbnail) return undefined;
    const radius = Number(this.refThumbnailPlugin?.['radius']);
    return Number.isFinite(radius) ? `${radius}` : undefined;
  }

  get lastSelected() {
    return this.scrollToLatest() && this.store.view.lastSelected?.url === this.ref().url;
  }

  get uploadedFile() {
    return this.ref().upload;
  }

  get existsFile() {
    return this.ref().exists;
  }

  get modifiedFile() {
    return this.ref().outdated;
  }

  get storyboardData() {
    if (!this.admin.getPlugin('plugin/image')) return null;
    if (!this.admin.getPlugin('plugin/thumbnail/storyboard')) return null;
    if (this.editing()) {
      return this.editForm.value?.plugins?.['plugin/thumbnail/storyboard'] || null;
    }
    return this.ref()?.plugins?.['plugin/thumbnail/storyboard']
      || this.repostRef()?.plugins?.['plugin/thumbnail/storyboard']
      || null;
  }

  private get storyboardRawUrl(): string | null {
    const sb = this.storyboardData;
    if (!sb?.url) return null;
    const rawUrl = String(sb.url);
    const origin = this.ref()?.origin || this.repostRef()?.origin || '';
    if (rawUrl.startsWith('cache:') || this.admin.getPlugin('plugin/thumbnail')?.config?.proxy) {
      return this.proxy.getFetch(rawUrl, origin, 'storyboard');
    } else {
      return rawUrl;
    }
  }

  get storyboardUrl(): string | null {
    return storyboardUrl(this.storyboardRawUrl);
  }

  get storyboardSize(): string | null {
    return storyboardSize(this.storyboardData);
  }

  get storyboardMargin(): string | null {
    return storyboardMargin(this.storyboardData);
  }

  get storyboardWidth(): string | null {
    return storyboardWidth(this.storyboardData);
  }

  get storyboardHeight(): string | null {
    return storyboardHeight(this.storyboardData);
  }

  get storyboardAnimation(): string | null {
    const animation = storyboardAnimation(this.storyboardData);
    if (!animation) return null;
    if (!document.getElementById(animation.styleId)) {
      const style = document.createElement('style');
      style.id = animation.styleId;
      style.textContent = animation.keyframes;
      document.head.appendChild(style);
    }
    return animation.value;
  }

  get obsoleteOrigin() {
    if (this.ref().metadata?.obsolete) return this.ref().origin;
    return undefined;
  }

  get fullscreenRequired() {
    if (!this.admin.getPlugin('plugin/fullscreen')) return false;
    if (!hasTag('plugin/fullscreen', this.currentTags)) return false;
    return !this.ref().plugins?.['plugin/fullscreen']?.optional;
  }

  get pipRequired() {
    if (!this.admin.pip) return false;
    return hasTag('plugin/pip', this.currentTags);
  }

  onFullscreenChange() {
    if (!this.fullscreen()) return;
    if (document.fullscreenElement) return;
    this.fullscreen.set(this.fullscreenRequired);
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

  get local() {
    return this.ref().origin === this.store.account.origin;
  }

  get localhost() {
    return this.ref().url.startsWith(this.config.base);
  }

  get repost() {
    return this.ref()?.sources?.[0] && hasTag('plugin/repost', this.ref());
  }

  get bareRepost() {
    return this.repost && !this.ref().title && !this.ref().comment;
  }

  get currentRef() {
    return this.repost ? this.repostRef() : this.ref();
  }

  get currentTags() {
    return uniq([...(this.repost ? this.repostRef()?.tags : this.ref().tags) || [], ...this.expandPlugins()]);
  }

  get bareRef() {
    return this.bareRepost ? this.repostRef() : this.ref();
  }

  get commentNoTitle() {
    if (this.altText) return false;
    return this.bareRef?.title && this.bareRef?.comment || hasComment(this.bareRef?.comment || '');
  }

  get feed() {
    return !!this.admin.getPlugin('plugin/script/feed') && hasTag('plugin/script/feed', this.ref());
  }

  get thread() {
    return !!this.admin.getPlugin('plugin/thread') && hasTag('plugin/thread', this.ref());
  }

  get comment() {
    return !!this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', this.ref());
  }

  get dm() {
    return !!this.admin.getTemplate('dm') && hasTag('dm', this.ref());
  }

  get email() {
    return !!this.admin.getTemplate('email') && hasTag('email', this.ref());
  }

  get remote() {
    return !!this.admin.getPlugin('+plugin/origin') && hasTag('+plugin/origin', this.ref());
  }

  get originPull() {
    return !!this.admin.getPlugin('+plugin/origin/pull') && hasTag('+plugin/origin/pull', this.ref());
  }

  get originPush() {
    return !!this.admin.getPlugin('+plugin/origin/push') && hasTag('+plugin/origin/push', this.ref());
  }

  get localOrigin() {
    if (this.originPull || this.originPush) {
      return this.ref().plugins?.['+plugin/origin']?.local && subOrigin(this.ref().origin, this.ref().plugins?.['+plugin/origin']?.local);
    }
    return undefined;
  }

  get remoteOrigin() {
    if (this.originPull || this.originPush) {
      return this.ref().plugins?.['+plugin/origin']?.remote;
    }
    return undefined;
  }

  get thumbnail() {
    if (!this.admin.getPlugin('plugin/thumbnail')) return false;
    if (this.editing()) {
      if (hasTag('plugin/thumbnail', this.editForm.value)) return true;
      if (!this.admin.getPlugin('plugin/image')) return false;
      return hasTag('plugin/image', this.editForm.value);
    }
    if (hasTag('plugin/thumbnail', this.ref()) || hasTag('plugin/thumbnail', this.repostRef())) return true;
    if (!this.admin.getPlugin('plugin/image')) return false;
    return hasTag('plugin/image', this.ref()) || hasTag('plugin/image', this.repostRef());
  }

  get thumbnailRefs() {
    return this.editing() ? [{ ...this.editForm.getRawValue(), origin: this.ref().origin }] : [this.repostRef(), this.ref()];
  }

  get refThumbnailPlugin() {
    const plugin = this.ref()?.plugins?.['plugin/thumbnail'] || this.repostRef()?.plugins?.['plugin/thumbnail'];
    return plugin && typeof plugin === 'object' && !Array.isArray(plugin) ? plugin : undefined;
  }

  refThumbnailString(key: 'url' | 'color' | 'emoji') {
    const value = this.refThumbnailPlugin?.[key];
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

  get thumbnailColor() {
    if (!this.thumbnail) return '';
    if (this.editing()) return this.editForm.value.plugins?.['plugin/thumbnail']?.color || '';
    return this.ref()?.plugins?.['plugin/thumbnail']?.color || this.repostRef()?.plugins?.['plugin/thumbnail']?.color || '';
  }

  get thumbnailEmoji() {
    if (!this.thumbnail) return '';
    if (this.editing()) return this.editForm.value.plugins?.['plugin/thumbnail']?.emoji || '';
    return this.ref()?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef()?.plugins?.['plugin/thumbnail']?.emoji || '';
  }

  get thumbnailEmojiDefaults() {
    const icon = this.icons().filter(i => i.thumbnail || (i.label && (i.order || 0) >= 0) && this.showIcon(i))[0];
    return icon?.label || icon?.thumbnail;
  }

  get thumbnailRadius() {
    if (this.editing()) return this.editForm.value.plugins?.['plugin/thumbnail']?.radius || 0;
    return this.ref()?.plugins?.['plugin/thumbnail']?.radius || this.repostRef()?.plugins?.['plugin/thumbnail']?.radius || 0;
  }

  get file() {
    return this.admin.getPlugin('plugin/file') &&
      hasTag('plugin/file', this.currentRef);
  }

  get audio() {
    return this.admin.getPlugin('plugin/audio') &&
      hasTag('plugin/audio', this.currentRef) &&
      (this.ref()?.plugins?.['plugin/audio']?.url || this.url);
  }

  get video() {
    return this.admin.getPlugin('plugin/video') &&
      hasTag('plugin/video', this.currentRef) &&
      (this.ref()?.plugins?.['plugin/video']?.url || this.url);
  }

  get image() {
    return this.admin.getPlugin('plugin/image') &&
      hasTag('plugin/image', this.currentRef) &&
      (this.ref()?.plugins?.['plugin/image']?.url || this.url);
  }

  getFilename(d = $localize`Untitled`) {
    const ext = getExtension(this.url) || '';
    const filename = this.ref()?.title || d;
    return filename + (ext && !filename.toLowerCase().endsWith(ext) ? ext : '');
  }

  get mediaAttachment() {
    if (this.file) {
      return this.proxy.getFetch(this.url, this.origin, this.getFilename());
    }
    if (this.audio && (this.audio.startsWith('cache:') || this.admin.getPlugin('plugin/audio')?.config?.proxy)) {
      return this.proxy.getFetch(this.audio, this.origin, this.getFilename($localize`Untitled Audio`));
    }
    if (this.video && (this.video.startsWith('cache:') || this.admin.getPlugin('plugin/video')?.config?.proxy)) {
      return this.proxy.getFetch(this.video, this.origin, this.getFilename($localize`Untitled Video`));
    }
    if (this.image && (this.image.startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy)) {
      return this.proxy.getFetch(this.image, this.origin, this.getFilename($localize`Untitled Image`));
    }
    return '';
  }

  get canInvoice() {
    if (!this.local) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor) return false;
    return hasTag('queue', this.ref());
  }

  get isAuthor() {
    return isAuthorTag(this.store.account.tag, this.ref());
  }

  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref());
  }

  get authors() {
    const lookup = this.store.origins.originMap.get(this.ref().origin || '');
    return uniq([
      ...this.ref().tags?.filter(t => this.admin.getPlugin(t)?.config?.signature === t) || [],
      ...authors(this.ref()).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  }

  readonly authorExts$ = computed(() => {
    return this.exts.getCachedExts(this.authors, this.ref().origin || '').pipe(this.admin.authorFallback);
  });

  get recipients() {
    const lookup = this.store.origins.originMap.get(this.ref().origin || '');
    const userRecipients = without(addressedTo(this.ref()), ...this.authors).map(a => {
      if (!tagOrigin(a)) return a;
      return localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a));
    });
    return [
      ...userRecipients,
      ...this.ref().tags?.filter(t => this.admin.getPlugin(t)?.config?.signature && this.admin.getPlugin(t)?.config?.signature != t) || [],
    ];
  }

  readonly recipientExts$ = computed(() => {
    return this.exts.getCachedExts(this.recipients, this.ref().origin || '').pipe(this.admin.recipientFallback);
  });

  get mailboxes() {
    return mailboxes(this.ref(), this.store.account.tag, this.store.origins.originMap);
  }

  get replySources() {
    const sources = [this.ref().url];
    if (this.comment || this.thread || this.email) {
      const refSources = this.ref().sources;
      if (refSources?.length) {
        sources.push(refSources[1] || refSources[0] || this.ref().url);
      }
    }
    return sources;
  }

  get replyTags(): string[] {
    const tags = [
      ...this.admin.reply.filter(p => hasTag(p.tag, this.ref())).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  get replyTo() {
    return this.authors.join(' ')
  }

  get tags() {
    return interestingTags(this.ref().tags);
  }

  readonly tagExts$ = computed(() => {
    return this.editor.getTagsPreview(this.tags, this.ref().origin || '');
  });

  get url() {
    return this.repost ? this.ref().sources![0] : this.ref().url;
  }

  get origin() {
    return this.bareRef?.origin;
  }

  get link() {
    if (this.file || this.url.startsWith('cache:')) return this.proxy.getFetch(this.url, this.origin, this.getFilename());
    return this.url;
  }

  get title() {
    if (this.editing()) return getTitle(this.editForm.value);
    if (this.bareRepost) return getTitle(this.repostRef()) || $localize`Repost`;
    return getTitle(this.ref());
  }

  get defaultView() {
    if (this.thread || this.threads || this.dm) return 'thread';
    if (this.comment) return 'comments';
    return undefined;
  }

  get host() {
    return urlSummary(this.url);
  }

  get tagLink() {
    return this.url.toLowerCase().startsWith('tag:/');
  }

  get editingLink() {
    if (!hasTag('plugin/editing', this.ref())) return undefined;
    if (this.url.startsWith('comment:')) {
      return { routerLink: ['/submit/text'], queryParams: { url: this.url } };
    }
    return { routerLink: ['/submit/web'], queryParams: { url: this.url } };
  }

  get submitRoute() {
    if (this.url.startsWith('comment:')) {
      return { routerLink: ['/submit/text'], queryParams: { url: this.url } };
    }
    return { routerLink: ['/submit/web'], queryParams: { url: this.url } };
  }

  get clickableLink() {
    if (this.file) return true;
    return clickableLink(this.url);
  }

  get redundantLink() {
    if (this.editingLink) return true;
    if (!this.clickableLink) return true;
    return this.expandPlugins().length;
  }

  get altText() {
    if (this.ref()?.tags?.includes('plugin/alt') || this.tags?.includes('plugin/alt')) {
      return this.bareRef?.comment;
    }
    return undefined;
  }

  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref().metadata?.plugins?.['plugin/comment'] || 0;
  }

  get newCommentsCount() {
    const lastSeen = this.store.local.getLastSeenCount(this.ref().url, 'comments');
    if (!lastSeen) return 0;
    return Math.max(0, this.comments - lastSeen);
  }

  get errors() {
    if (!this.admin.getPlugin('+plugin/log')) return 0;
    return this.ref().metadata?.plugins?.['+plugin/log'] || 0;
  }

  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.ref().metadata?.plugins?.['plugin/thread'] || 0;
  }

  get newThreadsCount() {
    const lastSeen = this.store.local.getLastSeenCount(this.ref().url, 'threads');
    if (!lastSeen) return 0;
    return Math.max(0,  this.threads - lastSeen);
  }

  get responses() {
    return this.ref().metadata?.responses || 0;
  }

  get newResponsesCount() {
    const lastSeen = this.store.local.getLastSeenCount(this.ref().url, 'replies');
    if (!lastSeen) return 0;
    return Math.max(0, this.responses - lastSeen);
  }

  get sources() {
    const sources = uniq(this.ref()?.sources).filter(s => s != this.ref().url);
    return sources.length || 0;
  }

  get top() {
    return top(this.ref());
  }

  get parent() {
    const sources = uniq(this.ref().sources).filter(s => s != this.ref().url);
    if (sources.length === 1) return sources[0];
    return false;
  }

  get parentComment() {
    if (!hasTag('plugin/comment', this.ref())) return false;
    if (this.ref().sources?.[0] === this.ref().url) return false;
    if (this.ref().sources?.[1] === this.ref().url) return false;
    if (this.sources === 1 || this.sources === 2) return this.ref().sources![0];
    return false;
  }

  get parentCommentTop() {
    if (!hasTag('plugin/comment', this.ref())) return false;
    if (this.ref().sources?.[0] === this.ref().url) return false;
    if (this.ref().sources?.[1] === this.ref().url) return false;
    if (this.sources === 2) return this.ref().sources![1];
    return false;
  }

  get parentThreadTop() {
    if (!hasTag('plugin/thread', this.ref())) return false;
    if (this.ref().sources?.[0] === this.ref().url) return false;
    if (this.ref().sources?.[1] === this.ref().url) return false;
    if (this.sources === 2) return this.ref().sources![1];
    if (this.sources === 1) return this.ref().sources![0];
    return false;
  }

  get publishedIsSubmitted() {
    const ref = this.ref();
    return !ref.published || Math.abs(ref.published.diff(ref.created!, 'seconds').seconds) <= 5;
  }

  get modifiedIsSubmitted() {
    const ref = this.ref();
    return !ref.modified || Math.abs(ref.modified.diff(ref.created!, 'seconds').seconds) <= 5;
  }

  get upvote() {
    return hasUserUrlResponse('plugin/user/vote/up', this.ref());
  }

  get downvote() {
    return hasUserUrlResponse('plugin/user/vote/down', this.ref());
  }

  get isView() {
    return isRef(this.ref(), this.store.view.ref);
  }

  toggle() {
    let read = false;
    if (this.editing()) {
      this.setEditing(false);
    } else if (this.viewSource()) {
      this.setViewSource(false);
    } else if (!this.fullscreen()) {
      if (this.store.hotkey && this.admin.getPlugin('plugin/fullscreen')) {
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
      } else if (this.pipRequired) {
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
    if (!this.admin.pip) return;
    this.store.eventBus.fire('pip', this.ref());
    this.markRead();
    if ('vibrate' in navigator) navigator.vibrate([2, 32, 4]);
    event?.preventDefault();
    event?.stopPropagation();
  }

  markRead() {
    markRead(this.admin, this.ts, this.ref());
    this.initFields(this.ref());
  }

  uiMarkdown(tag: string) {
    const plugin = this.admin.getPlugin(tag)!;
    return hydrate(plugin.config, 'infoUi', getPluginScope(plugin, this.ref()));
  }

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
    return visible(this.ref(), i, this.isAuthor, this.isRecipient) && active(this.ref(), i);
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
    if (!visible(this.ref(), a, this.isAuthor, this.isRecipient)) return false;
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
    if (this.upvote) {
      userUrls = without(userUrls, 'plugin/user/vote/up');
      request = this.ts.deleteResponse('plugin/user/vote/up', ref.url);
    } else if (!this.downvote) {
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
    if (this.downvote) {
      userUrls = without(userUrls, 'plugin/user/vote/down');
      request = this.ts.deleteResponse('plugin/user/vote/down', ref.url);
    } else if (!this.upvote) {
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
    const published = DateTime.fromISO(this.editForm.value.published);
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
      this.editForm.reset();
      this.init();
      this.store.submit.setRef(ref);
    } else {
      this.refreshTap = () => this.publishChanged.set(+published !== +this.ref().published!);
      this.submitting.set(this.store.eventBus.runAndReload(this.refs.update(ref).pipe(
        tap(cursor => {
          this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor));
          this.editForm.reset();
          this.submitting.set(undefined);
          this.setEditing(false);
          }),
        catchError((res: HttpErrorResponse) => {
          this.submitting.set(undefined);
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
      ), ref));
    }
  }

  copy$ = () => {
    const tags = uniq([
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...(this.ref().tags || [])
        .filter(t => hasPrefix(t, 'plugin') || !t.startsWith('+') && !t.startsWith('_'))
        .filter(t => !hasPrefix(t, 'user'))
        .filter(t => this.auth.canAddTag(t))
    ]);
    const copied: Ref = {
      ...this.ref(),
      origin: this.store.account.origin,
      tags,
    };
    copied.plugins = pick(copied.plugins, tags || []);
    if (hasTag('+plugin/origin', copied)) {
      copied.plugins['+plugin/origin'].local = copied.plugins['+plugin/origin'].remote = subOrigin(this.ref().origin, copied.plugins['+plugin/origin'].local);
      copied.plugins['+plugin/origin'].proxy = this.store.origins.lookup.get(this.ref().origin || '');
    }
    if (hasTag('+plugin/origin/tunnel', copied)) {
      copied.plugins['+plugin/origin/tunnel'] = this.store.origins.tunnelLookup.get(this.ref().origin || '');
    }
    return this.refs.create(copied).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.refs.get(this.ref().url, this.store.account.origin).pipe(
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
      switchMap(() => this.refs.get(this.ref().url, this.store.account.origin)),
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
      query: `!${this.store.account.origin || '*'}`,
      obsolete: null,
      size: 1,
      sort: ['modified,DESC']
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      map(page => {
        // Find the most recent remote version (not from local origin)
        const remoteVersion = page.content.find(r => r.origin !== this.store.account.origin);
        if (!remoteVersion) {
          throw new Error('No remote version found');
        }
        return remoteVersion;
      }),
      switchMap(remoteVersion =>
        this.refs.get(this.ref().url, this.store.account.origin).pipe(
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
    ref.origin = this.store.account.origin;
    ref.modifiedString = this.overwrite() ? this.overwrittenModified : this.ref().modifiedString;
    this.submitting.set(this.store.eventBus.runAndReload(this.refs.update(ref).pipe(
      tap(cursor => {
        this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor));
        this.submitting.set(undefined);
        this.setDiffing(false);
      }),
      catchError((res: HttpErrorResponse) => {
        this.submitting.set(undefined);
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
    ), ref));
  }

  upload$ = () => {
    const ref: Ref = {
      ...this.ref(),
      origin: this.store.account.origin,
      tags: this.ref().tags?.filter(t => this.auth.canAddTag(t)),
    };
    ref.plugins = pick(ref.plugins, ref.tags || []);
    return this.store.eventBus.runAndReload$(
      (this.store.submit.overwrite
        ? this.refs.update(ref)
        : this.refs.create(ref).pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 409) {
              return this.refs.get(this.ref().url, this.store.account.origin).pipe(
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
          tap(() => {
            this.store.submit.removeRef(ref);
            if (!this.store.submit.refs.length && !this.store.submit.exts.length) {
              this.router.navigate(['/ref', ref.url]);
            }
          }),
        )), ref);
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
    return (this.local && hasTag('locked', this.ref())
        ? this.ts.patch(['plugin/delete', 'internal'], this.ref().url, this.ref().origin)
        : this.local && !hasTag('plugin/delete', this.ref()) && this.admin.getPlugin('plugin/delete')
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
