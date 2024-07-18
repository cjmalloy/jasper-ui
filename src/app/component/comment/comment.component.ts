import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { Router } from '@angular/router';
import { delay, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject, takeUntil } from 'rxjs';
import { Ref } from '../../model/ref';
import {
  Action,
  active,
  Icon,
  ResponseAction,
  sortOrder,
  TagAction,
  uniqueConfigs,
  Visibility,
  visible
} from '../../model/tag';
import { deleteNotice } from '../../mods/delete';
import { getMailbox, mailboxes } from '../../mods/mailbox';
import { score } from '../../mods/vote';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';
import { ThreadStore } from '../../store/thread';
import { authors, formatAuthor, interestingTags } from '../../util/format';
import { getScheme } from '../../util/hosts';
import { memo, MemoCache } from '../../util/memo';
import { hasTag, hasUserUrlResponse, localTag, removeTag, tagOrigin, top } from '../../util/tag';
import { ActionComponent } from '../action/action.component';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
})
export class CommentComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'comment';
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];

  maxContext = 20;

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  ref!: Ref;
  @Input()
  scrollToLatest = false;
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
    private bookmarks: BookmarkService,
    private el: ElementRef<HTMLDivElement>,
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

  ngAfterViewInit(): void {
    if (this.scrollToLatest && this.lastSelected) {
      delay(() => scrollTo({ left: 0, top: this.el.nativeElement.getBoundingClientRect().top - 20, behavior: 'smooth' }), 400);
    }
  }

  init() {
    MemoCache.clear(this);
    this.editing = false;
    this.actionComponents?.forEach(c => c.reset());
    this.collapsed = !this.store.local.isRefToggled('comment:' + this.ref.url, true);
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
    this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));
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

  @HostBinding('class.last-selected')
  get lastSelected() {
    return this.store.view.lastSelected?.url === this.ref.url;
  }

  @memo
  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  @memo
  get top() {
    return top(this.ref);
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
    const lookup = this.store.origins.originMap.get(this.ref.origin || '');
    return uniq([
      ...this.ref.tags?.filter(t => t.startsWith('+plugin/') && this.admin.getPlugin(t)?.config?.signature) || [],
      ...authors(this.ref).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  }

  @memo
  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  @memo
  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  get replyExts() {
    return (this.ref.tags || [])
      .map(tag => this.admin.getPlugin(tag))
      .flatMap(p => p?.config?.reply)
      .filter(t => !!t) as string[];
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      'internal',
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
      ...this.replyExts,
    ];
    if (hasTag('public', this.ref)) tags.unshift('public');
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

  tag$ = (tag: string) => {
    this.serverError = [];
    return this.store.eventBus.runAndReload$(this.ts.create(tag, this.ref.url, this.ref.origin!), this.ref);
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

  delete$ = () => {
    const deleted = deleteNotice(this.ref);
    deleted.sources = this.ref.sources;
    deleted.tags = ['plugin/comment', 'plugin/delete', 'internal'];
    return this.store.eventBus.runAndReload$(this.refs.update(deleted), deleted);
  }

  loadMore() {
    this.depth ||= 0;
    this.depth++;
    runInAction(() => {
      this.thread.loadAdHoc(this.ref?.url);
    });
  }
}
