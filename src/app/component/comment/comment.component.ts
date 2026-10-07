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
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { delay, groupBy, uniq, without } from 'lodash-es';
import { Observable, Subject } from 'rxjs';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
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
import { RelativePipe } from '../../pipe/relative.pipe';
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
import { addPluginResponse, hasTag, hasUserUrlResponse, localTag, pluginResponses, removeTag, tagOrigin } from '../../util/tag';
import { ActionListComponent } from '../action/action-list/action-list.component';
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
  host: { 'class': 'comment', '[attr.tabindex]': '0', '[class.last-selected]': 'lastSelected()' },
  imports: [
    RelativePipe,
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
  ],
})
export class CommentComponent implements HasChanges {
  admin = inject(AdminService);
  store = inject(Store);
  thread = inject(ThreadStore);
  private auth = inject(AuthzService);
  private refs = inject(RefService);
  private exts = inject(ExtService);
  private editor = inject(EditorService);
  private ts = inject(TaggingService);
  private bookmarks = inject(BookmarkService);
  private el = inject<ElementRef<HTMLDivElement>>(ElementRef);

  maxContext = 20;

  readonly replyComponent = viewChild<CommentReplyComponent>('replyComponent');
  readonly editComponent = viewChild<CommentEditComponent>('editComponent');
  readonly threadComponent = viewChild<CommentThreadComponent>('threadComponent');

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());
  readonly scrollToLatest = input(false);
  readonly depthInput = input<number | null | undefined>(7, { alias: 'depth' });
  readonly depth = linkedSignal(() => this.depthInput());
  readonly context = input(0);
  readonly showLoadMore = input(true);

  commentEdited$ = new Subject<Ref>();
  readonly newComments = signal(0);
  newComments$ = new Subject<Ref | undefined>();
  readonly icons = computed(() => uniqueConfigs(sortOrder(this.admin.getIcons(this.ref().tags, this.ref().plugins, getScheme(this.ref().url)))));
  readonly actions = computed(() => uniqueConfigs(sortOrder(this.admin.getActions(this.ref().tags, this.ref().plugins))));
  readonly groupedActions = computed(() => groupBy(this.actions().filter(a => this.showAction(a)), a => (a as any)[this.label(a)]));
  readonly collapsed = linkedSignal(() => !this.store.local.isRefToggled('comment:' + this.ref().url, true));
  readonly replying = linkedSignal({ source: this.refInput, computation: () => false });
  readonly editing = linkedSignal({ source: this.ref, computation: () => false });
  readonly writeAccess = computed(() => this.auth.writeAccess(this.ref()));
  readonly taggingAccess = computed(() => this.auth.taggingAccess(this.ref()));
  readonly deleteAccess = computed(() => this.auth.deleteAccess(this.ref()));
  readonly serverError = signal<string[]>([]);

  constructor() {
    effect(() => {
      this.ref();
      untracked(() => this.init());
    });
    this.store.eventBus.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.event === 'refresh') {
        if (this.ref()?.url && this.store.eventBus.isRef(event, this.ref())) {
          if (event.ref) this.ref.set(event.ref);
        }
      }
      if (event.event === 'error') {
        if (this.ref()?.url && this.store.eventBus.isRef(event, this.ref())) {
          this.serverError.set(event.errors);
        }
      }
    });
    this.newComments$.pipe(
      takeUntilDestroyed(),
    ).subscribe(ref => {
      this.replying.set(false);
      if (ref) {
        this.newComments.update(n => n + 1);
        this.ref.update(r => {
          const copy: Ref = { ...r, metadata: {
            ...r.metadata,
            plugins: { ...r.metadata?.plugins },
            ...r.metadata?.remotePlugins ? { remotePlugins: { ...r.metadata.remotePlugins } } : {},
          } };
          addPluginResponse(copy, 'plugin/comment', (ref.origin || '') === (r.origin || ''));
          return copy;
        });
        if (this.depth() === 0) this.depth.set(1);
      }
    });
    this.commentEdited$.pipe(
      takeUntilDestroyed(),
    ).subscribe(ref => {
      this.editing.set(false);
      this.ref.set(ref);
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

  private readonly afterViewInit = afterNextRender(() => {
    if (this.scrollToLatest() && this.lastSelected()) {
      delay(() => scrollTo({ left: 0, top: this.el.nativeElement.getBoundingClientRect().top - 20, behavior: 'smooth' }), 400);
    }
  });

  init() {
  }

  private readonly onDestroy = inject(DestroyRef).onDestroy(() => {
    this.commentEdited$.complete();
    this.newComments$.complete();
  });

  readonly lastSelected = computed(() => {
    return this.store.view.lastSelected()?.url === this.ref().url;
  });

  readonly nonLocalOrigin = computed(() => {
    if (this.ref().origin === this.store.account.origin()) return undefined;
    return this.ref().origin || '';
  });

  readonly modifiedIsSubmitted = computed(() => {
    const ref = this.ref();
    return !ref.modified || Math.abs(ref.modified.diff(ref.created!, 'seconds').seconds) <= 5;
  });

  readonly canInvoice = computed(() => {
    if (this.ref().origin) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor()) return false;
    return hasTag('queue', this.ref());
  });

  readonly isAuthor = computed(() => {
    return this.authors().includes(this.store.account.tag());
  });

  readonly isRecipient = computed(() => {
    return hasTag(this.store.account.mailbox(), this.ref());
  });

  readonly authors = computed(() => {
    const lookup = this.store.origins.originMap().get(this.ref().origin || '');
    return uniq([
      ...this.ref().tags?.filter(t => t.startsWith('+plugin/') && this.admin.getPlugin(t)?.config?.signature) || [],
      ...authors(this.ref()).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  });

  readonly authorExts = rxResource({
    params: () => ({ tags: this.authors(), origin: this.ref().origin || '' }),
    stream: ({ params }) => this.exts.getCachedExts(params.tags, params.origin).pipe(this.admin.authorFallback),
  });

  readonly mailboxes = computed(() => {
    return mailboxes(this.ref(), this.store.account.tag(), this.store.origins.originMap());
  });

  readonly replyTags = computed((): string[] => {
    const tags = [
      ...this.admin.reply().filter(p => hasTag(p.tag, this.ref())).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes(),
    ];
    return removeTag(getMailbox(this.store.account.tag(), this.store.account.origin()), uniq(tags));
  });

  readonly tagged = computed(() => {
    return interestingTags(this.ref().tags);
  });

  readonly tagExts = rxResource({
    params: () => ({ tags: this.tagged(), origin: this.ref().origin || '' }),
    stream: ({ params }) => this.editor.getTagsPreview(params.tags, params.origin),
  });

  readonly deleted = computed(() => {
    return hasTag('plugin/delete', this.ref());
  });

  readonly comments = computed(() => {
    return pluginResponses(this.ref(), 'plugin/comment');
  });

  readonly moreComments = computed(() => {
    return this.comments() > (this.thread.cache().get(this.ref().url)?.length || 0) + this.newComments();
  });

  readonly responses = computed(() => {
    return this.ref().metadata?.responses || 0;
  });

  readonly sources = computed(() => {
    const sources = uniq(this.ref()?.sources).filter(s => s != this.ref().url);
    return sources.length || 0;
  });

  readonly upvote = computed(() => {
    return hasUserUrlResponse('plugin/user/vote/up', this.ref());
  });

  readonly downvote = computed(() => {
    return hasUserUrlResponse('plugin/user/vote/down', this.ref());
  });

  readonly score = computed(() => {
    return score(this.ref());
  });

  formatAuthor(user: string) {
    if (this.store.account.origin() && tagOrigin(user) === this.store.account.origin()) {
      user = user.replace(this.store.account.origin(), '');
    }
    return formatAuthor(user);
  }

  tag$ = (tag: string) => {
    this.serverError.set([]);
    return this.store.eventBus.runAndReload$(this.ts.create(tag, this.ref().url, this.ref().origin!), this.ref());
  }

  visible(v: Visibility) {
    return visible(this.ref(), v, this.isAuthor(), this.isRecipient());
  }

  label(a: Action) {
    if ('tag' in a || 'response' in a) {
      return active(this.ref(), a) ? 'labelOn' : 'labelOff';
    }
    return 'label';
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.ref(), a);
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
      if (a.scheme !== getScheme(this.ref().url)) return false;
    }
    if ('tag' in a) {
      if (a.tag === 'locked' && !this.writeAccess()) return false;
      if (a.tag && !this.taggingAccess()) return false;
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

  forceDelete$ = () => {
    const deleted = { ...deleteNotice(this.ref()), sources: this.ref().sources, tags: ['plugin/comment', 'plugin/delete', 'internal'] };
    return this.store.eventBus.runAndReload$(this.refs.delete(this.ref().url, this.ref().origin), deleted);
  }

  delete$ = () => {
    const deleted = { ...deleteNotice(this.ref()), sources: this.ref().sources, tags: ['plugin/comment', 'plugin/delete', 'internal'] };
    return this.store.eventBus.runAndReload$(this.refs.update(deleted), deleted);
  }

  loadMore() {
    this.depth.update(d => (d || 0) + 1);
    this.thread.loadAdHoc(this.ref()?.url);
  }
}
