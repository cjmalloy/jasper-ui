import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject, takeUntil } from 'rxjs';
import { Ref } from '../../model/ref';
import { Action, active, Icon, ResponseAction, sortOrder, TagAction, Visibility, visible } from '../../model/tag';
import { deleteNotice } from '../../plugin/delete';
import { getMailbox, mailboxes } from '../../plugin/mailbox';
import { score } from '../../plugin/vote';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { ThreadStore } from '../../store/thread';
import { authors, formatAuthor, interestingTags, TAGS_REGEX } from '../../util/format';
import { getScheme } from '../../util/hosts';
import { hasTag, hasUserUrlResponse, removeTag, tagOrigin } from '../../util/tag';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
})
export class CommentComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'comment';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();
  tagRegex = TAGS_REGEX.source;

  private disposers: IReactionDisposer[] = [];

  maxContext = 20;

  @Input()
  depth?: number | null = 7;
  @Input()
  context = 0

  _ref!: Ref;
  commentEdited$ = new Subject<Ref>();
  newComments = 0;
  newComments$ = new Subject<Ref | null>();
  icons: Icon[] = [];
  actions: Action[] = [];
  collapsed = false;
  replying = false;
  editing = false;
  tagging = false;
  deleting = false;
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    public thread: ThreadStore,
    private router: Router,
    private auth: AuthzService,
    private refs: RefService,
    private exts: ExtService,
    public acts: ActionService,
    private ts: TaggingService,
  ) {
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'refresh') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.ref = this.store.eventBus.ref;
        }
      }
      if (this.store.eventBus.event === 'error') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.serverError = this.store.eventBus.errors;
        }
      }
    }));
  }

  get origin() {
    return this.ref.origin || undefined;
  }

  get ref(): Ref {
    return this._ref;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.deleting = false;
    this.editing = false;
    this.tagging = false;
    this.collapsed = this.store.local.isRefToggled('comment:' + this.ref.url, this.ref.origin);
    this.writeAccess = this.auth.writeAccess(value);
    this.taggingAccess = this.auth.taggingAccess(value);
    this.icons = sortOrder(this.admin.getIcons(value.tags, value.plugins, getScheme(value.url)));
    this.actions = sortOrder(this.admin.getActions(value.tags, value.plugins));
  }

  get top() {
    if (hasTag('plugin/comment', this.store.view.ref)) {
      return this.store.view.ref?.sources?.[1] || this.store.view.ref?.sources?.[0];
    }
    return this.store.view.ref?.url;
  }

  ngOnInit(): void {
    this.newComments$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => {
      this.replying = false;
      if (ref) {
        this.newComments++;
        this.ref.metadata ||= {};
        this.ref.metadata.plugins ||= {};
        this.ref.metadata.plugins['plugin/comment'] ||= 0;
        this.ref.metadata.plugins['plugin/comment']++;
        if (this.depth === 0) this.depth = 1;
      }
    });
    this.commentEdited$.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => {
      this.editing = false;
      this.ref = ref;
    });
  }

  ngOnDestroy(): void {
    this.commentEdited$.complete();
    this.newComments$.complete();
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get canInvoice() {
    if (this.ref.origin) return false;
    if (!this.admin.status.plugins.invoice) return false;
    if (!this.isAuthor) return false;
    if (!this.ref.sources || !this.ref.sources.length) return false;
    return hasTag('plugin/comment', this.ref) ||
      !hasTag('internal', this.ref);
  }

  get isAuthor() {
    return this.authors.includes(this.store.account.tag);
  }

  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  get authors() {
    return authors(this.ref);
  }

  get authorExts() {
    return this.exts.getCachedExts(this.authors);
  }

  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  get replyTags(): string[] {
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq([
      'internal',
      'plugin/comment',
      'plugin/thread',
      ...this.admin.reply.filter(p => (this.ref.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
      ...this.tagged,
    ]));
  }

  get tagged() {
    return interestingTags(this.ref.tags);
  }

  get tagExts() {
    return this.exts.getCachedExts(this.tagged);
  }

  get deleted() {
    return hasTag('plugin/delete', this.ref);
  }

  get comments() {
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get moreComments() {
    return this.comments > (this.thread.cache.get(this.ref.url)?.length || 0) + this.newComments;
  }

  get responses() {
    return this.ref.metadata?.responses || 0;
  }

  get sources() {
    return this.ref.sources?.length || 0;
  }

  get parent() {
    if (!this.sources) return false;
    if (this.sources === 1) return true;
    if (this.sources > 2) return false;
    return this.ref.sources![0].startsWith('comment:') && this.ref.sources![1] === this.top;
  }

  get upvote() {
    return hasUserUrlResponse('plugin/vote/up', this.ref);
  }

  get downvote() {
    return hasUserUrlResponse('plugin/vote/down', this.ref);
  }

  get score() {
    return score(this.ref);
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
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
    this.store.eventBus.runAndReload(this.ts.create(field.value.trim(), this.ref.url, this.ref.origin!), this.ref);
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
    if (i.response) {
      this.router.navigate([], { queryParams: { filter: this.store.view.toggleFilter(i.response) }, queryParamsHandling: 'merge' });
    }
    if (i.tag) {
      this.router.navigate(['/tag', this.store.view.toggleTag(i.tag)], { queryParamsHandling: 'merge' });
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

  delete() {
    delete this.ref.title;
    delete this.ref.comment;
    delete this.ref.plugins;
    this.ref.tags = ['plugin/comment', 'plugin/delete', 'internal']
    this.store.eventBus.runAndReload(this.refs.update({
      ...deleteNotice(this.ref),
      sources: this.ref.sources,
      tags: this.ref.tags,
    }), this.ref);
  }

  loadMore() {
    this.depth ||= 0;
    this.depth++;
    runInAction(() => {
      this.thread.loadAdHoc(this.ref?.url);
    });
  }
}
