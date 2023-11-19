import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject, takeUntil } from 'rxjs';
import { Ref } from '../../model/ref';
import { Action, active, Icon, ResponseAction, sortOrder, TagAction, Visibility, visible } from '../../model/tag';
import { deleteNotice } from '../../mods/delete';
import { getMailbox, mailboxes } from '../../mods/mailbox';
import { score } from '../../mods/vote';
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
import { memo, MemoCache } from '../../util/memo';
import { hasTag, hasUserUrlResponse, removeTag, tagOrigin } from '../../util/tag';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
})
export class CommentComponent implements OnInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'comment';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();
  tagRegex = TAGS_REGEX.source;

  private disposers: IReactionDisposer[] = [];

  maxContext = 20;

  @Input()
  ref!: Ref;
  @Input()
  depth?: number | null = 7;
  @Input()
  context = 0

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
          this.ref = this.store.eventBus.ref!;
          this.init();
        }
      }
      if (this.store.eventBus.event === 'error') {
        if (this.ref?.url && this.store.eventBus.isRef(this.ref)) {
          this.serverError = this.store.eventBus.errors;
        }
      }
    }));
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
      this.init();
    });
  }

  init() {
    MemoCache.clear(this);
    this.deleting = false;
    this.editing = false;
    this.tagging = false;
    this.collapsed = this.store.local.isRefToggled('comment:' + this.ref.url, this.ref.origin);
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.icons = sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url)));
    this.actions = sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) {
      this.init();
    }
  }

  ngOnDestroy(): void {
    this.commentEdited$.complete();
    this.newComments$.complete();
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  @memo
  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  @memo
  get top() {
    if (hasTag('plugin/comment', this.store.view.ref)) {
      return this.store.view.ref?.sources?.[1] || this.store.view.ref?.sources?.[0];
    }
    return this.store.view.ref?.url;
  }

  @memo
  get canInvoice() {
    if (this.ref.origin) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor) return false;
    if (!this.ref.sources || !this.ref.sources.length) return false;
    return hasTag('plugin/comment', this.ref) ||
      !hasTag('internal', this.ref);
  }

  @memo
  get isAuthor() {
    return this.authors.includes(this.store.account.tag);
  }

  @memo
  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  @memo
  get authors() {
    return authors(this.ref);
  }

  @memo
  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  @memo
  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      'internal',
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    if (hasTag('public', this.ref)) tags.unshift('public');
    if (hasTag('plugin/email', this.ref)) tags.push('plugin/email');
    if (hasTag('plugin/comment', this.ref)) tags.push('plugin/comment');
    if (hasTag('plugin/thread', this.ref)) tags.push('plugin/thread');
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  @memo
  get tagged() {
    return interestingTags(this.ref.tags);
  }

  @memo
  get tagExts$() {
    return this.exts.getCachedExts(this.tagged, this.ref.origin || '').pipe(this.admin.extFallbacks);
  }

  @memo
  get deleted() {
    return hasTag('plugin/delete', this.ref);
  }

  @memo
  get comments() {
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get moreComments() {
    return this.comments > (this.thread.cache.get(this.ref.url)?.length || 0) + this.newComments;
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
  get upvote() {
    return hasUserUrlResponse('plugin/vote/up', this.ref);
  }

  @memo
  get downvote() {
    return hasUserUrlResponse('plugin/vote/down', this.ref);
  }

  @memo
  get score() {
    return score(this.ref);
  }

  @memo
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
    // TODO: bookmark service
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
    const deleted = deleteNotice(this.ref);
    deleted.sources = this.ref.sources;
    deleted.tags = ['plugin/comment', 'plugin/delete', 'internal']
    this.store.eventBus.runAndReload(this.refs.update(deleted), deleted);
  }

  loadMore() {
    this.depth ||= 0;
    this.depth++;
    runInAction(() => {
      this.thread.loadAdHoc(this.ref?.url);
    });
  }
}
