import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, pick, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { writePlugins } from '../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { getPluginScope, Plugin } from '../../model/plugin';
import { findExtension, isRef, Ref, writeRef } from '../../model/ref';
import {
  Action,
  active,
  hydrate,
  Icon,
  ResponseAction,
  sortOrder,
  TagAction,
  Visibility,
  visible
} from '../../model/tag';
import { addressedTo, getMailbox, mailboxes } from '../../mods/mailbox';
import { findArchive } from '../../mods/archive';
import { deleteNotice } from '../../mods/delete';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { OriginService } from '../../service/api/origin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { downloadRef } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import {
  authors,
  clickableLink,
  formatAuthor,
  hasComment,
  interestingTags,
  TAGS_REGEX,
  templates,
  trimCommentForTitle,
  urlSummary,
  userAuthors
} from '../../util/format';
import { getScheme } from '../../util/hosts';
import { printError } from '../../util/http';
import { capturesAny, hasTag, hasUserUrlResponse, isOwnerTag, removeTag, tagOrigin } from '../../util/tag';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefComponent implements OnInit, OnDestroy {
  css = 'ref list-item ';
  tagRegex = TAGS_REGEX.source;

  private disposers: IReactionDisposer[] = [];

  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;
  @Input()
  showAlarm = true;
  @Input()
  fetchRepost = true;

  repostRef?: Ref;
  editForm: UntypedFormGroup;
  submitted = false;
  expandPlugins: string[] = [];
  editorPlugins: string[] = [];
  icons: Icon[] = [];
  alarm?: string;
  actions: Action[] = [];
  infoUis: Plugin[] = [];
  publishedLabel = $localize`published`;
  tagging = false;
  editing = false;
  viewSource = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  actionsExpanded = false;
  title = '';
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];
  publishChanged = false;

  private _ref!: Ref;

  constructor(
    public admin: AdminService,
    public store: Store,
    private router: Router,
    private auth: AuthzService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    public acts: ActionService,
    private scraper: ScrapeService,
    private origins: OriginService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = refForm(fb);
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'refresh') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.ref = this.store.eventBus.ref!;
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

  @HostBinding('class')
  get pluginClasses() {
    return this.css + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '-'))
      .join(' ');
  }

  @HostBinding('class.last-selected')
  get lastSelected() {
    return isRef(this.store.view.lastSelected, this.ref);
  }

  @HostBinding('class.upload')
  get uploadedFile() {
    return this.ref.upload;
  }

  @HostBinding('class.exists')
  get existsFile() {
    return this.ref.exists;
  }

  get ref(): Ref {
    return this._ref;
  }

  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || (this.store.account.origin ? '' : undefined);
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.submitted = false;
    this.deleted = false;
    this.deleting = false;
    this.editing = false;
    this.viewSource = false;
    this.tagging = false;
    this.actionsExpanded = false;
    this.writeAccess = this.auth.writeAccess(value);
    this.taggingAccess = this.auth.taggingAccess(value);
    this.icons = sortOrder(this.admin.getIcons(value.tags, value.plugins, getScheme(value.url)));
    this.alarm = capturesAny(this.store.account.alarms, value.tags);
    this.actions = this.ref.created ? sortOrder(this.admin.getActions(value.tags, value.plugins)) : [];
    this.infoUis = this.admin.getPluginInfoUis(value.tags);
    this.publishedLabel = this.admin.getPublished(value.tags).join($localize`/`) || this.publishedLabel;

    this.title = this.getTitle();
    this.expandPlugins = this.admin.getEmbeds(value);
    if (this.repost) {
      if (value && this.fetchRepost && (!this.repostRef || this.repostRef.url != value.url && this.repostRef.origin === value.origin)) {
        this.refs.get(this.url, value.origin)
          .subscribe(ref => {
            this.repostRef = ref;
            if (this.bareRepost) {
              this.title = this.getTitle();
              this.expandPlugins = this.admin.getEmbeds(ref);
            }
          });
      }
    }
  }

  @ViewChild(RefFormComponent)
  set refForm(value: RefFormComponent) {
    defer(() => {
      value?.setRef(this.ref);
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

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  get repost() {
    return this.ref?.sources?.length && hasTag('plugin/repost', this.ref);
  }

  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  get commentNoTitle() {
    return this.bareRef?.title && this.bareRef?.comment || hasComment(this.bareRef?.comment || '');
  }

  get feed() {
    return !!this.admin.status.plugins.feed && hasTag('+plugin/feed', this.ref);
  }

  get thread() {
    return !!this.admin.status.plugins.thread && hasTag('plugin/thread', this.ref);
  }

  get comment() {
    return !!this.admin.status.plugins.comment && hasTag('plugin/comment', this.ref);
  }

  get dm() {
    return !!this.admin.status.templates.dm && hasTag('dm', this.ref);
  }

  get email() {
    return !!this.admin.status.templates.email && hasTag('email', this.ref);
  }

  get remote() {
    return !!this.admin.status.plugins.origin && hasTag('+plugin/origin', this.ref);
  }

  get originPull() {
    return !!this.admin.status.plugins.originPull && hasTag('+plugin/origin/pull', this.ref);
  }

  get originPush() {
    return !!this.admin.status.plugins.originPush && hasTag('+plugin/origin/push', this.ref);
  }

  get addTags() {
    if (this.feed) {
      return interestingTags(this.ref.plugins!['+plugin/feed'].addTags);
    }
    if (this.originPull) {
      return interestingTags(this.ref.plugins?.['+plugin/origin']?.addTags);
    }
    return undefined;
  }

  get addTagExts$() {
    return this.exts.getCachedExts(this.addTags || [], this.ref.origin || '');
  }

  get fromOrigin() {
    if (this.originPush) {
      return this.ref.plugins?.['+plugin/origin']?.local;
    }
    return undefined;
  }

  get addOrigin() {
    if (this.feed) {
      return this.ref.plugins!['+plugin/feed'].origin;
    }
    if (this.originPull) {
      return this.ref.plugins?.['+plugin/origin']?.local;
    }
    if (this.originPush) {
      return this.ref.plugins?.['+plugin/origin']?.remote;
    }
    return undefined;
  }

  get thumbnail() {
    return this.admin.status.plugins.thumbnail &&
      (hasTag('plugin/thumbnail', this.ref) || hasTag('plugin/thumbnail', this.repostRef));
  }

  get thumbnailUrl() {
    return this.thumbnail && !this.thumbnailColor;
  }

  get thumbnailColor() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.color || this.repostRef?.plugins?.['plugin/thumbnail']?.color);
  }

  get thumbnailEmoji() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef?.plugins?.['plugin/thumbnail']?.emoji) || '';
  }

  get thumbnailRadius() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.radius || this.repostRef?.plugins?.['plugin/thumbnail']?.radius) || 0;
  }

  get audio() {
    return this.admin.status.plugins.audio &&
      hasTag('plugin/audio', this.currentRef);
  }

  get video() {
    return this.admin.status.plugins.video &&
      hasTag('plugin/video', this.currentRef);
  }

  get image() {
    return this.admin.status.plugins.image &&
      hasTag('plugin/image', this.currentRef);
  }

  get mediaAttachment() {
    if (this.audio) {
      return this.currentRef?.plugins?.['plugin/audio']?.url;
    }
    if (this.video) {
      return this.currentRef?.plugins?.['plugin/video']?.url;
    }
    if (this.image) {
      return this.currentRef?.plugins?.['plugin/image']?.url;
    }
    return false;
  }

  get canInvoice() {
    if (!this.ref.created) return false;
    if (!this.local) return false;
    if (!this.admin.status.plugins.invoice) return false;
    if (!this.isAuthor) return false;
    if (!this.ref.sources || !this.ref.sources.length) return false;
    return hasTag('plugin/comment', this.ref) ||
      !hasTag('internal', this.ref);
  }

  get pdf() {
    if (!this.admin.status.plugins.pdf) return undefined;
    return this.ref.plugins?.['plugin/pdf']?.url || this.repostRef?.plugins?.['plugin/pdf']?.url || findExtension('.pdf', this.ref, this.repostRef);
  }

  get pdfUrl() {
    const url = this.pdf;
    if (!url) return url;
    if (!this.admin.status.plugins.pdf?.config?.cache) return url;
    return this.scraper.getFetch(url);
  }

  get archive() {
    const plugin = this.admin.getPlugin('plugin/archive');
    if (!plugin) return null;
    return this.ref.plugins?.['plugin/archive']?.url ||
      this.repostRef?.plugins?.['plugin/archive']?.url ||
      findArchive(plugin, this.ref) ||
      findArchive(plugin, this.repostRef);
  }

  get isAuthor() {
    return isOwnerTag(this.store.account.tag, this.ref);
  }

  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  get authors() {
    return authors(this.ref);
  }

  get userAuthors() {
    return userAuthors(this.ref);
  }

  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '');
  }

  get recipients() {
    return without(addressedTo(this.ref), ...this.authors);
  }

  get recipientExts$() {
    return this.exts.getCachedExts(this.recipients, this.ref.origin || '');
  }

  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  get replySources() {
    const sources = [this.ref.url];
    if (this.comment || this.dm || this.email) {
      if (this.ref.sources?.length) {
        sources.push(this.ref.sources[1] || this.ref.sources[0]);
      }
    }
    return sources;
  }

  get replyTags(): string[] {
    const tags = [
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    if (hasTag('plugin/email', this.store.view.ref)) tags.push('internal', 'plugin/email');
    if (hasTag('plugin/comment', this.store.view.ref)) tags.push('internal', 'plugin/comment');
    if (hasTag('plugin/thread', this.store.view.ref)) tags.push('internal', 'plugin/thread');
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  get replyTo() {
    return this.authors.join(' ')
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  get tagExts$() {
    return this.exts.getCachedExts(this.tags, this.ref.origin || '');
  }

  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  get currentRef() {
    return this.repost ? this.repostRef : this.ref;
  }

  get bareRef() {
    return this.bareRepost ? this.repostRef : this.ref;
  }

  get host() {
    return urlSummary(this.url);
  }

  get clickableLink() {
    return clickableLink(this.url);
  }

  get comments() {
    if (!this.admin.status.plugins.comment) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get threads() {
    if (!this.admin.status.plugins.thread) return 0;
    return this.ref.metadata?.plugins?.['plugin/thread'] || 0;
  }

  get responses() {
    return this.ref.metadata?.responses || 0;
  }

  get sources() {
    return this.ref.sources?.length || 0;
  }

  get parentComment() {
    if (!hasTag('plugin/comment', this.ref)) return false;
    if (this.sources === 1 || this.sources === 2) return this.ref.sources![0];
    return false;
  }

  get parentCommentTop() {
    if (!hasTag('plugin/comment', this.ref)) return false;
    if (this.sources === 2) return this.ref.sources![1];
    return false;
  }

  get parentThreadTop() {
    if (!hasTag('plugin/thread', this.ref)) return false;
    if (this.sources === 2) return this.ref.sources![1];
    if (this.sources === 1) return this.ref.sources![0];
    return false;
  }

  get publishedIsSubmitted() {
    return !this.ref.published || Math.abs(this.ref.published.diff(this.ref.created, 'seconds')) <= 5;
  }

  get modifiedIsSubmitted() {
    return !this.ref.modified || Math.abs(this.ref.modified.diff(this.ref.created, 'seconds')) <= 5;
  }

  get upvote() {
    return hasUserUrlResponse('plugin/vote/up', this.ref);
  }

  get downvote() {
    return hasUserUrlResponse('plugin/vote/down', this.ref);
  }

  get fullscreen() {
    return hasTag('plugin/fullscreen', this.ref);
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  download() {
    downloadRef(writeRef(this.ref));
  }

  downloadMedia() {
    window.open(this.mediaAttachment, "_blank");
  }

  addInlineTag(field: HTMLInputElement) {
    if (field.validity.patternMismatch) {
      this.serverError = [$localize`
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.`];
      return;
    }
    if (this.ref.upload) {
      runInAction(() => {
        this.ref.tags ||= [];
        for (const t of (field.value || '').split(' ').filter(t => !!t)) {
          if (t.startsWith('-')) {
            this.ref.tags = without(this.ref.tags, t.substring(1));
          } else if (!this.ref.tags.includes(t)) {
            this.ref.tags.push(t);
          }
        }
      });
      this.ref = this.ref;
    } else {
      this.store.eventBus.runAndReload(this.ts.create(field.value, this.ref.url, this.ref.origin!), this.ref);
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

  clickIcon(i: Icon) {
    // TODO: bookmark service
    if (i.response) {
      this.router.navigate([], { queryParams: { filter: this.store.view.toggleFilter(i.response) }, queryParamsHandling: 'merge' });
    }
    if (i.tag) {
      this.router.navigate(['/tag', this.store.view.toggleTag(i.tag)], { queryParamsHandling: 'merge' });
    }
    if (i.scheme) {
      this.router.navigate([], { queryParams: { filter: this.store.view.toggleFilter(`scheme/${i.scheme}`) }, queryParamsHandling: 'merge' });
    }
  }

  showAction(a: Action) {
    if (!this.visible(a)) return false;
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
    const tags = uniq([...without(this.editForm.value.tags, ...this.admin.editorTags), ...this.editorPlugins]);
    const published = moment(this.editForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    const ref = {
      ...this.ref,
      ...this.editForm.value,
      tags,
      published,
      plugins: writePlugins(tags, {
        ...this.ref.plugins,
        ...this.editForm.value.plugins,
      }),
    };
    if (this.ref.upload) {
      ref.upload = true;
      this.ref = ref;
      this.store.submit.setRef(this.ref);
    } else {
      this.store.eventBus.runAndReload(this.refs.update(ref), ref);
    }
  }

  copy() {
    const tags = uniq([
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...(this.ref.tags || []).filter(t => this.auth.canAddTag(t))
    ]);
    this.refs.create({
      ...this.ref,
      origin: this.store.account.origin,
      tags,
    }, true).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.refs.get(this.ref.url, this.ref.origin)
            .subscribe(ref => this.ref.created = ref.created);
        }
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.store.submit.removeRef(this.ref);
      this.router.navigate(['/ref', this.ref.url], { queryParams: { origin: this.store.account.origin }})
    });
  }

  upload() {
    const ref = {
      ...this.ref,
      origin: this.store.account.origin,
      tags: this.ref.tags?.filter(t => this.auth.canAddTag(t)),
    };
    ref.plugins = pick(ref.plugins as any, ref.tags as string[]);
    this.store.eventBus.runAndReload((this.store.submit.overwrite ? this.refs.push(ref) : this.refs.create(ref)), ref);
  }

  delete() {
    (this.admin.status.plugins.delete
      ? this.refs.update(deleteNotice(this.ref))
      : this.refs.delete(this.ref.url, this.ref.origin)
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleting = false;
      this.deleted = true;
    });
  }

  remove() {
    this.serverError = [];
    this.store.submit.removeRef(this.ref);
    this.deleting = false;
    this.deleted = true;
  }

  getTitle() {
    if (this.bareRepost) return this.repostRef?.title || $localize`Repost`;
    const title = (this.ref.title || '').trim();
    const comment = (this.ref.comment || '').trim();
    if (title) return title;
    if (this.thread) return 'Re:';
    if (!comment) return this.url;
    return trimCommentForTitle(comment);
  }

  renderInfo(plugin: Plugin): string {
    return hydrate(plugin.config, 'infoUi', getPluginScope(plugin, this.ref));
  }
}
