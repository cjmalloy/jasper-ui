import {
  AsyncPipe
} from '@angular/common';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  OnDestroy,
  ChangeDetectionStrategy,
  effect,
  input,
  linkedSignal,
  viewChildren,
  viewChild,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { delay, groupBy, uniq, without } from 'lodash-es';
import { Subject } from 'rxjs';
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
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
  host: { 'class': 'comment', '[attr.tabindex]': '0', '[class.last-selected]': 'lastSelected' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FakeLinkDirective,
    CommentThreadComponent,
    forwardRef(() => ViewerComponent),
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
export class CommentComponent implements AfterViewInit, OnDestroy, HasChanges {
  maxContext = 20;

  readonly actionComponents = viewChildren<ActionComponent>('action');
  readonly replyComponent = viewChild<CommentReplyComponent>('replyComponent');
  readonly editComponent = viewChild<CommentEditComponent>('editComponent');
  readonly threadComponent = viewChild<CommentThreadComponent>('threadComponent');

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  private readonly refSignal = linkedSignal(() => this.refInput());
  get ref() { return this.refSignal(); }
  set ref(value: Ref) { this.refSignal.set(value); }
  readonly scrollToLatest = input(false);
  readonly depthInput = input<number | null | undefined>(7, { alias: 'depth' });
  private readonly depthSignal = linkedSignal(() => this.depthInput());
  get depth() { return this.depthSignal(); }
  set depth(value: number | null | undefined) { this.depthSignal.set(value); }
  readonly context = input(0);
  readonly showLoadMore = input(true);

  commentEdited$ = new Subject<Ref>();
  private readonly newCommentsSignal = signal(0);
  newComments$ = new Subject<Ref | undefined>();
  private readonly iconsSignal = signal<Icon[]>([]);
  private readonly actionsSignal = signal<Action[]>([]);
  private readonly groupedActionsSignal = signal<Record<string, Action[]>>({});
  private readonly collapsedSignal = signal(false);
  private readonly replyingSignal = signal(false);
  private readonly editingSignal = signal(false);
  private readonly writeAccessSignal = signal(false);
  private readonly taggingAccessSignal = signal(false);
  private readonly deleteAccessSignal = signal(false);
  private readonly serverErrorSignal = signal<string[]>([]);

  get newComments() { return this.newCommentsSignal(); }
  set newComments(value: number) { this.newCommentsSignal.set(value); }
  get icons() { return this.iconsSignal(); }
  set icons(value: Icon[]) { this.iconsSignal.set(value); }
  get actions() { return this.actionsSignal(); }
  set actions(value: Action[]) { this.actionsSignal.set(value); }
  get groupedActions() { return this.groupedActionsSignal(); }
  set groupedActions(value: Record<string, Action[]>) { this.groupedActionsSignal.set(value); }
  get collapsed() { return this.collapsedSignal(); }
  set collapsed(value: boolean) { this.collapsedSignal.set(value); }
  get replying() { return this.replyingSignal(); }
  set replying(value: boolean) { this.replyingSignal.set(value); }
  get editing() { return this.editingSignal(); }
  set editing(value: boolean) { this.editingSignal.set(value); }
  get writeAccess() { return this.writeAccessSignal(); }
  set writeAccess(value: boolean) { this.writeAccessSignal.set(value); }
  get taggingAccess() { return this.taggingAccessSignal(); }
  set taggingAccess(value: boolean) { this.taggingAccessSignal.set(value); }
  get deleteAccess() { return this.deleteAccessSignal(); }
  set deleteAccess(value: boolean) { this.deleteAccessSignal.set(value); }
  get serverError() { return this.serverErrorSignal(); }
  set serverError(value: string[]) { this.serverErrorSignal.set(value); }

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
      this.refInput();
      this.init();
    });
    this.store.eventBus.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.event === 'refresh') {
        if (this.ref?.url && this.store.eventBus.isRef(event, this.ref)) {
          this.ref = event.ref!;
          this.init();
        }
      }
      if (event.event === 'error') {
        if (this.ref?.url && this.store.eventBus.isRef(event, this.ref)) {
          this.serverError = event.errors;
        }
      }
    });
    this.newComments$.pipe(
      takeUntilDestroyed(),
    ).subscribe(ref => {
      this.replying = false;
      if (ref) {
        this.newComments++;
        this.ref.metadata ||= {};
        this.ref.metadata.plugins ||= {};
        this.ref.metadata.plugins['plugin/comment'] ||= 0;
        this.ref.metadata.plugins['plugin/comment']++;
        this.ref = { ...this.ref, metadata: { ...this.ref.metadata, plugins: { ...this.ref.metadata.plugins } } };
        if (this.depth === 0) this.depth = 1;
      }
    });
    this.commentEdited$.pipe(
      takeUntilDestroyed(),
    ).subscribe(ref => {
      this.editing = false;
      this.ref = ref;
      this.init();
    });
  }

  saveChanges() {
    const editComponent = this.editComponent();
    const replyComponent = this.replyComponent();
    const threadComponent = this.threadComponent();
    return (!editComponent || editComponent.saveChanges())
      && (!replyComponent || replyComponent.saveChanges())
      && (!threadComponent || threadComponent.saveChanges());
  }

  ngAfterViewInit(): void {
    if (this.scrollToLatest() && this.lastSelected) {
      delay(() => scrollTo({ left: 0, top: this.el.nativeElement.getBoundingClientRect().top - 20, behavior: 'smooth' }), 400);
    }
  }

  init() {
    this.editing = false;
    this.actionComponents()?.forEach(c => c.reset());
    this.collapsed = !this.store.local.isRefToggled('comment:' + this.ref.url, true);
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.deleteAccess = this.auth.deleteAccess(this.ref);
    this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
    this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));
    this.groupedActions = groupBy(this.actions.filter(a => this.showAction(a)), a => (a as any)[this.label(a)]);
  }

  ngOnDestroy(): void {
    this.commentEdited$.complete();
    this.newComments$.complete();
  }

  get lastSelected() {
    return this.store.view.lastSelected?.url === this.ref.url;
  }

  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  get modifiedIsSubmitted() {
    return !this.ref.modified || Math.abs(this.ref.modified.diff(this.ref.created!, 'seconds').seconds) <= 5;
  }

  get canInvoice() {
    if (this.ref.origin) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor) return false;
    return hasTag('queue', this.ref);
  }

  get isAuthor() {
    return this.authors.includes(this.store.account.tag);
  }

  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  get authors() {
    const lookup = this.store.origins.originMap.get(this.ref.origin || '');
    return uniq([
      ...this.ref.tags?.filter(t => t.startsWith('+plugin/') && this.admin.getPlugin(t)?.config?.signature) || [],
      ...authors(this.ref).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  }

  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  get replyTags(): string[] {
    const tags = [
      ...this.admin.reply.filter(p => hasTag(p.tag, this.ref)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  get tagged() {
    return interestingTags(this.ref.tags);
  }

  get tagExts$() {
    return this.editor.getTagsPreview(this.tagged, this.ref.origin || '');
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
    const sources = uniq(this.ref?.sources).filter(s => s != this.ref.url);
    return sources.length || 0;
  }

  get upvote() {
    return hasUserUrlResponse('plugin/user/vote/up', this.ref);
  }

  get downvote() {
    return hasUserUrlResponse('plugin/user/vote/down', this.ref);
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
    this.ref = { ...this.ref, metadata: { ...this.ref.metadata, userUrls: [...this.ref.metadata.userUrls] } };
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
    this.ref = { ...this.ref, metadata: { ...this.ref.metadata, userUrls: [...this.ref.metadata.userUrls] } };
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
