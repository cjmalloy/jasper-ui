import { AsyncPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { delay, groupBy, uniq, without } from 'lodash-es';

import { Subject, takeUntil } from 'rxjs';
import { TitleDirective } from '../../directive/title.directive';
import { HasChanges } from '../../guard/pending-changes.guard';
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
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { ThreadStore } from '../../store/thread';
import { authors, formatAuthor, interestingTags } from '../../util/format';
import { getScheme } from '../../util/http';
import { memo, MemoCache } from '../../util/memo';
import { hasTag, hasUserUrlResponse, localTag, removeTag, tagOrigin } from '../../util/tag';
import { ActionListComponent } from '../action/action-list/action-list.component';
import { ActionComponent } from '../action/action.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { InlineTagComponent } from '../action/inline-tag/inline-tag.component';
import { ViewerComponent } from '../viewer/viewer.component';
import { CommentEditComponent } from './comment-edit/comment-edit.component';
import { CommentReplyComponent } from './comment-reply/comment-reply.component';
import { CommentThreadComponent } from './comment-thread/comment-thread.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
  host: { 'class': 'comment' },
  imports: [
    CommentThreadComponent,
    ViewerComponent,
    RouterLink,
    TitleDirective,
    CommentEditComponent,
    ConfirmActionComponent,
    InlineTagComponent,
    ActionListComponent,
    CommentReplyComponent,
    AsyncPipe,
  ],
})
export class CommentComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy, HasChanges {
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();

  maxContext = 20;

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;
  @ViewChild('replyComponent')
  replyComponent?: CommentReplyComponent;
  @ViewChild('editComponent')
  editComponent?: CommentEditComponent;
  @ViewChild('threadComponent')
  threadComponent?: CommentThreadComponent;

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
  newComments$ = new Subject<Ref | undefined>();
  icons: Icon[] = [];
  actions: Action[] = [];
  groupedActions: { [key: string]: Action[] } = {};
  collapsed = false;
  replying = false;
  editing = false;
  writeAccess = false;
  taggingAccess = false;
  deleteAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
    public thread: ThreadStore,
    private auth: AuthzService,
    private refs: RefService,
    private exts: ExtService,
    private editor: EditorService,
    private ts: TaggingService,
    private bookmarks: BookmarkService,
    private el: ElementRef<HTMLDivElement>,
  ) {
    effect(() => {
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
    });
  }

  saveChanges() {
    return (!this.editComponent || this.editComponent.saveChanges())
      && (!this.replyComponent || this.replyComponent.saveChanges())
      && (!this.threadComponent || this.threadComponent.saveChanges());
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
    this.deleteAccess = this.auth.deleteAccess(this.ref);
    this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
    this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));
    this.groupedActions = groupBy(this.actions.filter(a => this.showAction(a)), a => (a as any)[this.label(a)]);
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
  get modifiedIsSubmitted() {
    return !this.ref.modified || Math.abs(this.ref.modified.diff(this.ref.created!, 'seconds').seconds) <= 5;
  }

  @memo
  get canInvoice() {
    if (this.ref.origin) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor) return false;
    return hasTag('queue', this.ref);
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

  @memo
  get replyTags(): string[] {
    const tags = [
      ...this.admin.reply.filter(p => hasTag(p.tag, this.ref)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  @memo
  get tagged() {
    return interestingTags(this.ref.tags);
  }

  @memo
  get tagExts$() {
    return this.editor.getTagsPreview(this.tagged, this.ref.origin || '');
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
    const sources = uniq(this.ref?.sources).filter(s => s != this.ref.url);
    return sources.length || 0;
  }

  @memo
  get upvote() {
    return hasUserUrlResponse('plugin/user/vote/up', this.ref);
  }

  @memo
  get downvote() {
    return hasUserUrlResponse('plugin/user/vote/down', this.ref);
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
    return visible(this.ref, v, this.isAuthor, this.isRecipient);
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
    if (i.anyResponse) {
      this.bookmarks.toggleFilter(i.anyResponse);
    }
    if (i.tag) {
      this.bookmarks.toggleFilter((ctrl ? `query/!(${i.tag})` : `query/${i.tag}`));
    }
  }

  showAction(a: Action) {
    if (!this.visible(a)) return false;
    if ('scheme' in a) {
      if (a.scheme !== getScheme(this.ref.url)) return false;
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
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/user/vote/up');
      this.store.eventBus.runAndRefresh(this.ts.deleteResponse('plugin/user/vote/up', this.ref.url), this.ref);
    } else if (!this.downvote) {
      this.ref.metadata.userUrls.push('plugin/user/vote/up');
      this.store.eventBus.runAndRefresh(this.ts.createResponse('plugin/user/vote/up', this.ref.url), this.ref);
    } else {
      this.ref.metadata.userUrls.push('plugin/user/vote/up');
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/user/vote/down');
      this.store.eventBus.runAndRefresh(this.ts.respond(['plugin/user/vote/up', '-plugin/user/vote/down'], this.ref.url), this.ref);
    }
  }

  voteDown() {
    this.ref.metadata ||= {};
    this.ref.metadata.userUrls ||= [];
    if (this.downvote) {
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/user/vote/down');
      this.store.eventBus.runAndRefresh(this.ts.deleteResponse('plugin/user/vote/down', this.ref.url), this.ref);
    } else if (!this.upvote) {
      this.ref.metadata.userUrls.push('plugin/user/vote/down');
      this.store.eventBus.runAndRefresh(this.ts.createResponse('plugin/user/vote/down', this.ref.url), this.ref);
    } else {
      this.ref.metadata.userUrls.push('plugin/user/vote/down');
      this.ref.metadata.userUrls = without(this.ref.metadata.userUrls, 'plugin/user/vote/up');
      this.store.eventBus.runAndRefresh(this.ts.respond(['-plugin/user/vote/up', 'plugin/user/vote/down'], this.ref.url), this.ref);
    }
  }

  forceDelete$ = () => {
    const deleted = deleteNotice(this.ref);
    deleted.sources = this.ref.sources;
    deleted.tags = ['plugin/comment', 'plugin/delete', 'internal'];
    return this.store.eventBus.runAndReload$(this.refs.delete(this.ref.url, this.ref.origin), deleted);
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
    this.thread.loadAdHoc(this.ref?.url);
  }
}
