import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewChildren,
  ViewContainerRef
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { defer, delay, pick, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, map, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { writePlugins } from '../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { getPluginScope, Plugin } from '../../model/plugin';
import { equalsRef, Ref, writeRef } from '../../model/ref';
import {
  Action,
  active,
  hydrate,
  Icon,
  ResponseAction,
  sortOrder,
  TagAction,
  uniqueConfigs,
  Visibility,
  visible
} from '../../model/tag';
import { deleteNotice } from '../../mods/delete';
import { addressedTo, getMailbox, mailboxes } from '../../mods/mailbox';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { downloadRef } from '../../util/download';
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
import { getScheme, printError } from '../../util/http';
import { memo, MemoCache } from '../../util/memo';
import {
  capturesAny,
  hasTag,
  hasUserUrlResponse,
  includesTag,
  isOwnerTag,
  localTag,
  removeTag,
  subOrigin,
  tagOrigin,
  top
} from '../../util/tag';
import { ActionComponent } from '../action/action.component';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefComponent implements OnChanges, AfterViewInit, OnDestroy {
  css = 'ref list-item';
  private disposers: IReactionDisposer[] = [];

  @ViewChild('actionsMenu')
  actionsMenu!: TemplateRef<any>;
  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  ref!: Ref;
  @Input()
  expanded = false;
  @Input()
  plugins?: string[];
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;
  @Input()
  scrollToLatest = false;
  @Input()
  hideEdit = false;
  @Input()
  disableResize = false;
  @Input()
  showAlarm = true;
  @Input()
  fetchRepost = true;
  @Output()
  copied = new EventEmitter<string>();

  repostRef?: Ref;
  editForm: UntypedFormGroup;
  submitted = false;
  invalid = false;
  overwrite = true;
  force = false;
  expandPlugins: string[] = [];
  icons: Icon[] = [];
  alarm?: string;
  actions: Action[] = [];
  advancedActions: Action[] = [];
  infoUis: Plugin[] = [];
  submittedLabel = $localize`submitted`;
  publishedLabel = $localize`published`;
  editing = false;
  viewSource = false;
  @HostBinding('class.deleted')
  deleted = false;
  @HostBinding('class.mobile-unlock')
  mobileUnlock = false;
  actionsExpanded?: boolean;
  replyTags: string[] = [];
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];
  publishChanged = false;
  overlayRef?: OverlayRef;

  submitting?: Subscription;
  private overlayEvents?: Subscription;
  private refreshTap?: () => void;

  constructor(
    public config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    public acts: ActionService,
    private bookmarks: BookmarkService,
    private proxy: ProxyService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private el: ElementRef<HTMLDivElement>,
    private zone: NgZone,
  ) {
    this.editForm = refForm(fb);
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'refresh') {
        if (this.editing || this.viewSource) {
          // TODO: show somewhere
          console.warn('Ignoring Ref edit.');
          return;
        }
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.ref = this.store.eventBus.ref!;
          this.init();
          if (this.refreshTap) {
            this.refreshTap();
            delete this.refreshTap;
          }
        }
      }
      if (this.store.eventBus.event === 'error') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.serverError = this.store.eventBus.errors;
        }
      }
      if (this.store.eventBus.event === 'toggle') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.expanded = !this.expanded;
        }
      }
      if (this.store.eventBus.event === 'toggle-all-open') {
        this.expanded = true;
      }
      if (this.store.eventBus.event === 'toggle-all-closed') {
        this.expanded = false;
      }
    }));
  }

  init() {
    MemoCache.clear(this);
    this.serverError.length = 0;
    this.submitted = false;
    this.invalid = false;
    this.overwrite = false;
    this.force = false;
    this.deleted = false;
    this.editing = false;
    this.viewSource = false;
    this.actionsExpanded = undefined;
    this.actionComponents?.forEach(c => c.reset());
    if (this.ref?.upload) this.editForm.get('url')!.enable();
    this.replyTags = this.getReplyTags();
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
    this.alarm = capturesAny(this.store.account.alarms, this.ref.tags);
    this.actions = this.ref.created ? uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins))) : [];
    // TODO: detect width and move actions that don't fit into advanced actions
    this.advancedActions = this.ref.created ? sortOrder(this.admin.getAdvancedActions(this.ref.tags, this.ref.plugins)) : [];
    this.infoUis = this.admin.getPluginInfoUis(this.ref.tags);
    this.publishedLabel = this.admin.getPublished(this.ref.tags).join($localize`/`) || this.publishedLabel;

    this.expandPlugins = this.admin.getEmbeds(this.ref);
    if (this.repost) {
      if (this.ref && this.fetchRepost && (!this.repostRef || this.repostRef.url != this.ref.url && this.repostRef.origin === this.ref.origin)) {
        this.refs.get(this.url, this.ref.origin).subscribe(ref => {
          this.repostRef = ref;
          MemoCache.clear(this);
          if (this.bareRepost) {
            this.expandPlugins = this.admin.getEmbeds(ref);
          } else {
            this.expandPlugins.push('plugin/repost');
          }
        });
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) {
      this.init();
    }
  }

  ngAfterViewInit(): void {
    delay(() => {
      if (this.scrollToLatest && this.lastSelected) {
        scrollTo({ left: 0, top: this.el.nativeElement.getBoundingClientRect().top - 20, behavior: 'smooth' });
      }
    }, 400);
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    if (this.scrollToLatest && this.lastSelected) {
      this.store.view.clearLastSelected();
    }
  }

  unlockViewer(event: Event) {
    if (!this.config.mobile) return;
    this.mobileUnlock = !this.mobileUnlock;
    event.preventDefault();
  }

  @HostBinding('class')
  get pluginClasses() {
    return this.css + ' ' + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/[+_]/g, '').replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  }

  @HostBinding('class.last-selected')
  get lastSelected() {
    return this.store.view.lastSelected?.url === this.ref.url;
  }

  @HostBinding('class.upload')
  get uploadedFile() {
    return this.ref.upload;
  }

  @HostBinding('class.exists')
  get existsFile() {
    return this.ref.exists;
  }

  get obsoleteOrigin() {
    if (this.ref.metadata?.obsolete) return this.ref.origin;
    return undefined;
  }

  @ViewChild(RefFormComponent)
  set refForm(value: RefFormComponent) {
    if (!value) return;
    defer(() => {
      value.setRef(this.ref);
      this.editor.syncEditor(this.fb, this.editForm, this.ref.comment);
    });
  }

  @HostListener('fullscreenchange')
  onFullscreenChange() {
    if (!this.fullscreen) return;
    if (this.ref.plugins?.['plugin/fullscreen']?.optional) return;
    if (!document.fullscreenElement) {
      this.expanded = false;
    }
  }

  @HostListener('click')
  onClick() {
    if (!this.lastSelected && this.store.view.lastSelected) {
      this.store.view.clearLastSelected();
    }
  }

  @ViewChild(ViewerComponent)
  set viewer(value: ViewerComponent | undefined) {
    if (!this.fullscreen) return;
    if (value) {
      value.el.nativeElement.requestFullscreen().catch(() => {
        console.warn('Could not make fullscreen.');
        this.expanded = false;
      });
    }
  }

  @memo
  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  @memo
  get localhost() {
    return this.ref.url.startsWith(this.config.base);
  }

  @memo
  get repost() {
    return this.ref?.sources?.length && hasTag('plugin/repost', this.ref);
  }

  @memo
  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  @memo
  get currentRef() {
    return this.repost ? this.repostRef : this.ref;
  }

  @memo
  get currentTags() {
    return uniq([...(this.repost ? this.repostRef?.tags : this.ref.tags) || [], ...this.expandPlugins]);
  }

  @memo
  get bareRef() {
    return this.bareRepost ? this.repostRef : this.ref;
  }

  @memo
  get commentNoTitle() {
    if (this.altText) return false;
    return this.bareRef?.title && this.bareRef?.comment || hasComment(this.bareRef?.comment || '');
  }

  @memo
  get feed() {
    return !!this.admin.getPlugin('plugin/feed') && hasTag('plugin/feed', this.ref);
  }

  @memo
  get thread() {
    return !!this.admin.getPlugin('plugin/thread') && hasTag('plugin/thread', this.ref);
  }

  @memo
  get comment() {
    return !!this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', this.ref);
  }

  @memo
  get dm() {
    return !!this.admin.getTemplate('dm') && hasTag('dm', this.ref);
  }

  @memo
  get email() {
    return !!this.admin.getTemplate('email') && hasTag('email', this.ref);
  }

  @memo
  get remote() {
    return !!this.admin.getPlugin('+plugin/origin') && hasTag('+plugin/origin', this.ref);
  }

  @memo
  get originPull() {
    return !!this.admin.getPlugin('+plugin/origin/pull') && hasTag('+plugin/origin/pull', this.ref);
  }

  @memo
  get originPush() {
    return !!this.admin.getPlugin('+plugin/origin/push') && hasTag('+plugin/origin/push', this.ref);
  }

  @memo
  get addTags() {
    if (this.feed) {
      return interestingTags(this.ref.plugins?.['plugin/feed']?.addTags);
    }
    if (this.originPull) {
      return interestingTags(this.ref.plugins?.['+plugin/origin']?.addTags);
    }
    return undefined;
  }

  @memo
  get addTagExts$() {
    return this.exts.getCachedExts(this.addTags || [], this.ref.origin || '').pipe(this.admin.extFallbacks);
  }

  @memo
  get fromOrigin() {
    if (this.originPush) {
      return this.ref.plugins?.['+plugin/origin']?.local;
    }
    return undefined;
  }

  @memo
  get addOrigin() {
    if (this.originPull) {
      return subOrigin(this.ref.origin, this.ref.plugins?.['+plugin/origin']?.local);
    }
    if (this.originPush) {
      return this.ref.plugins?.['+plugin/origin']?.remote;
    }
    return undefined;
  }

  @memo
  get thumbnail() {
    return this.admin.getPlugin('plugin/thumbnail') &&
      (hasTag('plugin/thumbnail', this.ref) || hasTag('plugin/thumbnail', this.repostRef));
  }

  @memo
  get thumbnailColor() {
    if (!this.thumbnail) return '';
    return this.ref?.plugins?.['plugin/thumbnail']?.color || this.repostRef?.plugins?.['plugin/thumbnail']?.color || '';
  }

  @memo
  get thumbnailEmoji() {
    if (!this.thumbnail) return '';
    return this.ref?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef?.plugins?.['plugin/thumbnail']?.emoji || '';
  }

  @memo
  get thumbnailEmojiDefaults() {
    const iconLabel = this.icons.filter(i => i.label && (i.order || 0) >= 0 && this.showIcon(i))[0];
    const iconThumbnail = this.icons.filter(i => i.thumbnail && this.showIcon(i))[0];
    return iconLabel?.label || iconThumbnail?.thumbnail;
  }

  @memo
  get thumbnailRadius() {
    return this.ref?.plugins?.['plugin/thumbnail']?.radius || this.repostRef?.plugins?.['plugin/thumbnail']?.radius || 0;
  }

  @memo
  get file() {
    return this.admin.getPlugin('plugin/file') &&
      hasTag('plugin/file', this.currentRef);
  }

  @memo
  get audio() {
    return this.admin.getPlugin('plugin/audio') &&
      hasTag('plugin/audio', this.currentRef);
  }

  @memo
  get video() {
    return this.admin.getPlugin('plugin/video') &&
      hasTag('plugin/video', this.currentRef);
  }

  @memo
  get image() {
    return this.admin.getPlugin('plugin/image') &&
      hasTag('plugin/image', this.currentRef);
  }

  @memo
  get mediaAttachment() {
    if (this.file) {
      return this.proxy.getFetch(this.url);
    }
    if (this.audio && this.admin.getPlugin('plugin/audio')?.config?.proxy) {
      return this.proxy.getFetch(this.url);
    }
    if (this.video && this.admin.getPlugin('plugin/video')?.config?.proxy) {
      return this.proxy.getFetch(this.url);
    }
    if (this.image && this.admin.getPlugin('plugin/image')?.config?.proxy) {
      return this.proxy.getFetch(this.url);
    }
    return false;
  }

  @memo
  get canInvoice() {
    if (!this.ref.created) return false;
    if (!this.local) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor) return false;
    if (!this.ref.sources || !this.ref.sources.length) return false;
    return hasTag('plugin/comment', this.ref) ||
      !hasTag('internal', this.ref);
  }

  @memo
  @HostBinding('class.sent')
  get isAuthor() {
    return isOwnerTag(this.store.account.tag, this.ref);
  }

  @memo
  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  @memo
  get authors() {
    const lookup = this.store.origins.originMap.get(this.ref.origin || '');
    return uniq([
      ...this.ref.tags?.filter(t => this.admin.getPlugin(t)?.config?.signature === t) || [],
      ...authors(this.ref).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  }

  @memo
  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  @memo
  get recipients() {
    const lookup = this.store.origins.originMap.get(this.ref.origin || '');
    const userRecipients = without(addressedTo(this.ref), ...this.authors).map(a => {
      if (!tagOrigin(a)) return a;
      return localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a));
    });
    return [
      ...userRecipients,
      ...this.ref.tags?.filter(t => this.admin.getPlugin(t)?.config?.signature && this.admin.getPlugin(t)?.config?.signature != t) || [],
    ];
  }

  @memo
  get recipientExts$() {
    return this.exts.getCachedExts(this.recipients, this.ref.origin || '').pipe(this.admin.recipientFallback);
  }

  @memo
  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replySources() {
    const sources = [this.ref.url];
    if (this.comment || this.thread || this.email) {
      if (this.ref.sources?.length) {
        sources.push(this.ref.sources[1] || this.ref.sources[0]);
      }
    }
    return sources;
  }

  @memo
  getReplyTags(): string[] {
    const tags = [
      ...this.admin.reply.filter(p => (this.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    if (hasTag('public', this.ref)) tags.unshift('public');
    if (hasTag('plugin/email', this.ref)) tags.push('internal', 'plugin/email');
    if (hasTag('plugin/comment', this.ref)) tags.push('internal', 'plugin/comment');
    if (hasTag('plugin/thread', this.ref)) tags.push('internal', 'plugin/thread');
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  @memo
  get replyTo() {
    return this.authors.join(' ')
  }

  @memo
  get tags() {
    return interestingTags(this.ref.tags);
  }

  @memo
  get tagExts$() {
    return this.exts.getCachedExts(this.tags, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  @memo
  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  @memo
  get link() {
    if (this.file) return this.proxy.getFetch(this.url);
    return this.url;
  }

  @memo
  get title() {
    if (this.bareRepost) return getTitle(this.repostRef) || $localize`Repost`;
    return getTitle(this.ref);
  }

  @memo
  get defaultView() {
    if (this.thread) return 'thread';
    if (this.comment) return 'comments';
    return undefined;
  }

  @memo
  get host() {
    return urlSummary(this.url);
  }

  @memo
  get clickableLink() {
    if (this.file) return true;
    return clickableLink(this.url);
  }

  @memo
  get redundantLink() {
    if (!this.clickableLink) return true;
    return this.expandPlugins.length;
  }

  @memo
  get altText() {
    if (this.ref?.tags?.includes('plugin/alt') || this.tags?.includes('plugin/alt')) {
      return this.bareRef?.comment;
    }
    return undefined;
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get errors() {
    if (!this.admin.getPlugin('+plugin/log')) return 0;
    return this.ref.metadata?.plugins?.['+plugin/log'] || 0;
  }

  @memo
  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.ref.metadata?.plugins?.['plugin/thread'] || 0;
  }

  @memo
  get responses() {
    return this.ref.metadata?.responses || 0;
  }

  @memo
  get sources() {
    return this.ref.sources?.length || 0;
  }

  @memo
  get top() {
    return top(this.ref);
  }

  @memo
  get parentComment() {
    if (!hasTag('plugin/comment', this.ref)) return false;
    if (this.sources === 1 || this.sources === 2) return this.ref.sources![0];
    return false;
  }

  @memo
  get parentCommentTop() {
    if (!hasTag('plugin/comment', this.ref)) return false;
    if (this.sources === 2) return this.ref.sources![1];
    return false;
  }

  @memo
  get parentThreadTop() {
    if (!hasTag('plugin/thread', this.ref)) return false;
    if (this.sources === 2) return this.ref.sources![1];
    if (this.sources === 1) return this.ref.sources![0];
    return false;
  }

  @memo
  get publishedIsSubmitted() {
    return !this.ref.published || Math.abs(this.ref.published.diff(this.ref.created, 'seconds')) <= 5;
  }

  @memo
  get modifiedIsSubmitted() {
    return !this.ref.modified || Math.abs(this.ref.modified.diff(this.ref.created, 'seconds')) <= 5;
  }

  @memo
  get upvote() {
    return hasUserUrlResponse('plugin/vote/up', this.ref);
  }

  @memo
  get downvote() {
    return hasUserUrlResponse('plugin/vote/down', this.ref);
  }

  @memo
  get fullscreen() {
    if (this.plugins) return includesTag('plugin/fullscreen', this.plugins);
    return hasTag('plugin/fullscreen', this.ref);
  }

  @memo
  uiMarkdown(tag: string) {
    const plugin = this.admin.getPlugin(tag)!;
    return hydrate(plugin.config, 'infoUi', getPluginScope(plugin, this.ref));
  }

  formatAuthor(user: string) {
    return formatAuthor(user);
  }

  download() {
    downloadRef(writeRef(this.ref));
  }

  downloadMedia() {
    if (!this.mediaAttachment) return;
    window.open(this.mediaAttachment, "_blank");
  }

  tag$ = (tag: string) => {
    if (this.ref.upload) {
      runInAction(() => {
        this.ref.tags ||= [];
        for (const t of tag.split(' ').filter(t => !!t)) {
          if (t.startsWith('-')) {
            this.ref.tags = without(this.ref.tags, t.substring(1));
          } else if (!this.ref.tags.includes(t)) {
            this.ref.tags.push(t);
          }
        }
      });
      this.init();
      return of(null);
    } else {
      return this.store.eventBus.runAndReload$(this.ts.create(tag, this.ref.url, this.ref.origin!), this.ref);
    }
  }

  visible(v: Visibility) {
    return visible(v, this.isAuthor, this.isRecipient);
  }

  label(a: Action) {
    if ('tag' in a || 'response' in a) {
      return active(this.ref, a) ? 'labelOn' : 'labelOff';
    }
    return 'label';
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.ref, a);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  clickIcon(i: Icon, ctrl: boolean) {
    if (i.response) {
      this.bookmarks.toggleFilter(i.response);
    }
    if (i.tag) {
      this.bookmarks.toggleFilter((ctrl ? `query/!(${i.tag})` : `query/${i.tag}`));
    }
    if (i.scheme) {
      this.bookmarks.toggleFilter(`scheme/${i.scheme}`);
    }
  }

  showAction(a: Action) {
    if (!this.visible(a)) return false;
    if ('scheme' in a) {
      if (a.scheme !== getScheme(this.repostRef?.url || this.ref.url)) return false;
    }
    if ('tag' in a) {
      if (a.tag === 'locked' && !this.writeAccess) return false;
      if (a.tag && !this.taggingAccess) return false;
      if (a.tag && !this.auth.canAddTag(a.tag)) return false;
    }
    if ('tag' in a || 'response' in a) {
      if (this.active(a) && !a.labelOn) return false;
      if (!this.active(a) && !a.labelOff) return false;
    } else {
      if (!a.label) return false;
    }
    return true;
  }

  voteUp() {
    this.ref.metadata ||= {};
    this.ref.metadata.userUrls ||= [];
    if (this.upvote) {
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/vote/up');
      this.store.eventBus.runAndRefresh(this.ts.deleteResponse('plugin/vote/up', this.ref.url), this.ref);
    } else if (!this.downvote) {
      this.ref.metadata.userUrls.push('plugin/vote/up');
      this.store.eventBus.runAndRefresh(this.ts.createResponse('plugin/vote/up', this.ref.url), this.ref);
    } else {
      this.ref.metadata.userUrls.push('plugin/vote/up');
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/vote/down');
      this.store.eventBus.runAndRefresh(this.ts.respond(['plugin/vote/up', '-plugin/vote/down'], this.ref.url), this.ref);
    }
  }

  voteDown() {
    this.ref.metadata ||= {};
    this.ref.metadata.userUrls ||= [];
    if (this.downvote) {
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/vote/down');
      this.store.eventBus.runAndRefresh(this.ts.deleteResponse('plugin/vote/down', this.ref.url), this.ref);
    } else if (!this.upvote) {
      this.ref.metadata.userUrls.push('plugin/vote/down');
      this.store.eventBus.runAndRefresh(this.ts.createResponse('plugin/vote/down', this.ref.url), this.ref);
    } else {
      this.ref.metadata.userUrls.push('plugin/vote/down');
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/vote/up');
      this.store.eventBus.runAndRefresh(this.ts.respond(['-plugin/vote/up', 'plugin/vote/down'], this.ref.url), this.ref);
    }
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    this.editor.syncEditor(this.fb, this.editForm);
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = moment(this.editForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    let ref = {
      ...this.editForm.value,
      published,
      plugins: writePlugins(this.editForm.value.tags, this.editForm.value.plugins),
    };
    if (this.ref.upload || !this.invalid || !this.overwrite) {
      ref = {
        ...this.ref,
        ...ref,
        plugins: writePlugins(this.editForm.value.tags, {
          ...this.ref.plugins,
          ...ref.plugins,
        }),
      }
    }
    if (this.ref.upload) {
      ref.upload = true;
      this.init();
      this.store.submit.setRef(this.ref);
    } else {
      this.refreshTap = () => this.publishChanged = !published.isSame(this.ref.published);
      this.submitting = this.store.eventBus.runAndReload(this.refs.update(ref, this.force).pipe(
        tap(() => {
          delete this.submitting;
          this.editing = false;
        }),
        catchError((res: HttpErrorResponse) => {
          delete this.submitting;
          if (res.status === 400) {
            if (this.invalid) {
              this.force = true;
            } else {
              this.invalid = true;
            }
          }
          return throwError(() => res);
        }),
      ), ref);
    }
  }

  copy$ = () => {
    const tags = uniq([
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...(this.ref.tags || []).filter(t => this.auth.canAddTag(t))
    ]);
    const copied: Ref = {
      ...this.ref,
      origin: this.store.account.origin,
      tags,
    };
    copied.plugins = pick(copied.plugins, tags || []);
    return this.refs.create(copied, true).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.refs.get(this.ref.url, this.store.account.origin).pipe(
            switchMap(existing => {
              if (equalsRef(existing, copied) || window.confirm('An old version already exists. Overwrite it?')) {
                // TODO: Show diff and merge or split
                return this.refs.update({ ...copied, modifiedString: existing.modifiedString }, true);
              } else {
                return throwError(() => 'Cancelled')
              }
            })
          );
        }
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.ref.url, this.store.account.origin)),
      tap(ref => {
        this.ref = ref;
        this.init();
      })
    );
  }

  upload$ = () => {
    const ref: Ref = {
      ...this.ref,
      origin: this.store.account.origin,
      tags: this.ref.tags?.filter(t => this.auth.canAddTag(t)),
    };
    ref.plugins = pick(ref.plugins, ref.tags || []);
    return this.store.eventBus.runAndReload$(
      (this.store.submit.overwrite
        ? this.refs.update(ref, true)
        : this.refs.create(ref, true).pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 409) {
              return this.refs.get(this.ref.url, this.store.account.origin).pipe(
                switchMap(existing => {
                  if (existing.modified?.isSame(ref.modified) || equalsRef(existing, ref) || window.confirm('An old version already exists. Overwrite it?')) {
                    // TODO: Show diff and merge or split
                    return this.refs.update({ ...ref, modifiedString: existing.modifiedString }, true);
                  } else {
                    return throwError(() => 'Cancelled');
                  }
                })
              );
            }
            return throwError(() => err);
          }),
        )), ref);
  }

  delete$ = () => {
    this.serverError = [];
    return (this.local && hasTag('locked', this.ref)
        ? this.ts.patch(['plugin/delete', 'internal'], this.ref.url, this.ref.origin).pipe(map(() => {}))
        : this.local && !hasTag('plugin/delete', this.ref) && this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(this.ref)).pipe(map(() => {}))
        : this.refs.delete(this.ref.url, this.ref.origin)
    ).pipe(
      tap(() => this.deleted = true),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  remove$ = () => {
    this.serverError = [];
    this.store.submit.removeRef(this.ref);
    this.deleted = true;
    return of(null);
  }

  showAdvanced(event: MouseEvent) {
    this.closeAdvanced();
    defer(() => {
      const positionStrategy = this.overlay.position()
        .flexibleConnectedTo({x: event.x, y: event.y})
        .withPositions([{
          originX: 'center',
          originY: 'center',
          overlayX: 'start',
          overlayY: 'top',
        }]);
      this.overlayRef = this.overlay.create({
        positionStrategy,
        scrollStrategy: this.overlay.scrollStrategies.close(),
      });
      this.overlayRef.attach(new TemplatePortal(this.actionsMenu, this.viewContainerRef));
      this.overlayEvents = this.overlayRef.outsidePointerEvents().subscribe((event: MouseEvent) => {
        switch (event.type) {
          case 'click':
          case 'pointerdown':
          case 'touchstart':
          case 'mousedown':
          case 'contextmenu':
            this.zone.run(() => this.closeAdvanced());
        }
      });
    });
  }

  closeAdvanced() {
    this.overlayRef?.dispose();
    this.overlayEvents?.unsubscribe();
    this.overlayRef = undefined;
    this.overlayEvents = undefined;
    return false;
  }

  delayLastSelected() {
    delay(() => this.store.view.setLastSelected(this.ref), 200);
  }
}
