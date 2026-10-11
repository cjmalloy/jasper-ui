import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { defer, groupBy, intersection, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, finalize, map, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { TitleDirective } from '../../../directive/title.directive';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Ref, writeRef } from '../../../model/ref';
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
} from '../../../model/tag';
import { deleteNotice } from '../../../mods/delete';
import { getMailbox, mailboxes, mapRemoteOrigin } from '../../../mods/mailbox';
import { findArchive } from '../../../mods/tools/archive';
import { RelativePipe } from '../../../pipe/relative.pipe';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { EditorService } from '../../../service/editor.service';
import { Store } from '../../../store/store';
import { downloadRef } from '../../../util/download';
import { controlState, scrollToFirstInvalid } from '../../../util/form';
import { authors, clickableLink, formatAuthor, interestingTags } from '../../../util/format';
import { getScheme, printError } from '../../../util/http';
import { hasTag, isAuthorTag, pluginResponses, removeTag, tagOrigin } from '../../../util/tag';
import { ActionListComponent } from '../../action/action-list/action-list.component';
import { ConfirmActionComponent } from '../../action/confirm-action/confirm-action.component';
import { InlineTagComponent } from '../../action/inline-tag/inline-tag.component';
import { CommentReplyComponent } from '../../comment/comment-reply/comment-reply.component';
import { ThreadSummaryComponent } from '../../comment/thread-summary/thread-summary.component';
import { LoadingComponent } from '../../loading/loading.component';
import { NavComponent } from '../../nav/nav.component';
import { ViewerComponent } from '../../viewer/viewer.component';

@Component({
  selector: 'app-blog-entry',
  templateUrl: './blog-entry.component.html',
  styleUrls: ['./blog-entry.component.scss'],
  host: { 'class': 'blog-entry', '[attr.tabindex]': '0', '[class.deleted]': 'deleted()' },
  imports: [
    RelativePipe,
    FakeLinkDirective,
    forwardRef(() => ViewerComponent),
    forwardRef(() => RefFormComponent),
    forwardRef(() => CommentReplyComponent),
    forwardRef(() => ThreadSummaryComponent),
    NavComponent,
    RouterLink,
    TitleDirective,
    ConfirmActionComponent,
    InlineTagComponent,
    ActionListComponent,
    ReactiveFormsModule,
    LoadingComponent,
  ],
})
export class BlogEntryComponent implements HasChanges {
  private config = inject(ConfigService);
  admin = inject(AdminService);
  store = inject(Store);
  private auth = inject(AuthzService);
  private editor = inject(EditorService);
  private refs = inject(RefService);
  private exts = inject(ExtService);
  private bookmarks = inject(BookmarkService);
  private ts = inject(TaggingService);
  private router = inject(Router);
  private fb = inject(UntypedFormBuilder);

  private destroyRef = inject(DestroyRef);

  readonly refForm = viewChild<RefFormComponent>('refForm');

  readonly blog = input<Ext>();
  readonly refInput = input.required<Ref>({ alias: 'ref' });
  readonly ref = linkedSignal(() => this.refInput());

  private readonly repostResource = rxResource({
    params: () => this.repost() ? { url: this.url(), top: this.store.view.top() } : undefined,
    stream: ({ params }) => (params.top?.url === params.url
      ? of(params.top)
      : this.refs.getCurrent(params.url)).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
      ),
  });
  readonly repostRef = computed(() => this.repostResource.hasValue() ? this.repostResource.value() : undefined);

  editForm: UntypedFormGroup;
  protected readonly editFormValid = controlState(() => this.editForm, c => c.valid);
  protected readonly editFormDirty = controlState(() => this.editForm, c => c.dirty);
  readonly submitted = linkedSignal({ source: this.ref, computation: () => false });
  readonly icons = computed(() => uniqueConfigs(sortOrder(this.admin.getIcons(this.ref().tags, this.ref().plugins, getScheme(this.ref().url)))));
  readonly actions = computed(() => uniqueConfigs(sortOrder(this.admin.getActions(this.ref().tags, this.ref().plugins))));
  readonly groupedActions = computed(() => groupBy(this.actions().filter(a => this.showAction(a)), a => (a as any)[this.label(a)]));
  readonly editing = linkedSignal({ source: this.ref, computation: () => false });
  readonly viewSource = linkedSignal({ source: this.ref, computation: () => false });
  readonly deleted = linkedSignal({ source: this.ref, computation: () => false });
  readonly writeAccess = computed(() => this.auth.writeAccess(this.ref()));
  readonly taggingAccess = computed(() => this.auth.taggingAccess(this.ref()));
  readonly deleteAccess = computed(() => this.auth.deleteAccess(this.ref()));
  readonly replying = linkedSignal({ source: this.refInput, computation: () => false });
  readonly serverError = signal<string[]>([]);

  readonly submitting = signal(false);
  private submittingSubscription?: Subscription;

  summaryItems = 5;

  constructor() {
    const fb = this.fb;

    this.editForm = refForm(fb);
    effect(() => {
      this.ref();
      untracked(() => this.init());
    });
    effect(() => {
      this.refInput();
      untracked(() => this.submittingSubscription?.unsubscribe());
    });
    effect(() => {
      const value = this.refForm();
      const ref = untracked(() => this.ref());
      defer(() => {
        value?.setRef(ref);
        this.editor.syncEditor(this.fb, this.editForm, ref.comment);
      });
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
  }

  saveChanges() {
    return !this.editing() || !this.editForm.dirty;
  }

  init() {
  }

  readonly nonLocalOrigin = computed(() => {
    if (this.ref().origin === this.store.account.origin()) return undefined;
    return this.ref().origin || '';
  });

  readonly repost = computed(() => {
    return this.ref()?.sources?.[0] && hasTag('plugin/repost', this.ref());
  });

  readonly bareRepost = computed(() => this.repost() && !this.ref().title && !this.ref().comment);
  readonly currentRef = computed(() => this.repost() ? this.repostRef() : this.ref());
  readonly bareRef = computed(() => this.bareRepost() ? this.repostRef() : this.ref());
  readonly url = computed(() => this.repost() ? this.ref().sources![0] : this.ref().url);

  readonly title = computed((): string => {
    const title = (this.ref().title || '').trim();
    const comment = (this.ref().comment || '').trim();
    if (title) return title;
    if (!comment) return this.ref().url;
    if (comment.length <= 140) return comment;
    return comment.substring(0, 140);
  });

  readonly canInvoice = computed(() => {
    if (!this.local()) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor()) return false;
    return hasTag('queue', this.ref());
  });

  readonly local = computed(() => {
    return this.ref().origin === this.store.account.origin();
  });

  readonly localhost = computed(() => {
    return this.ref().url.startsWith(this.config.base);
  });

  readonly pdf = computed(() => {
    if (!this.admin.getPlugin('plugin/pdf')) return null;
    return this.ref().plugins?.['plugin/pdf']?.url || this.findPdf();
  });

  readonly findPdf = computed(() => {
    const alternateUrls = this.ref().alternateUrls;
    if (!alternateUrls) return null;
    for (const s of alternateUrls) {
      if (new URL(s).pathname.endsWith('.pdf')) {
        return s;
      }
    }
    return null;
  });

  readonly archive = computed(() => {
    const plugin = this.admin.getPlugin('plugin/archive');
    if (!plugin) return null;
    return this.ref().plugins?.['plugin/archive']?.url || findArchive(plugin, this.ref());
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
      ...this.ref().tags?.filter(t => t.startsWith('+plugin/') && this.admin.getPlugin(t)?.config?.signature) || [],
      ...authors(this.ref()).map(a => mapRemoteOrigin(a, this.ref().origin || '', this.store.account.origin(), lookup)),
    ]);
  });

  readonly authorExts = rxResource({
    params: () => ({ tags: this.authors(), origin: this.ref().origin || '' }),
    stream: ({ params }) => this.exts.getCachedExts(params.tags, params.origin).pipe(this.admin.authorFallback),
  });

  readonly tags = computed(() => {
    let result = interestingTags(this.ref().tags);
    const blog = this.blog();
    if (!blog?.config?.filterTags) return result;
    return intersection(result, blog.config.tags || []);
  });

  readonly tagExts = rxResource({
    params: () => ({ tags: this.tags(), origin: this.ref().origin || '' }),
    stream: ({ params }) => this.editor.getTagsPreview(params.tags, params.origin),
  });

  readonly tagLink = computed(() => {
    return this.url().toLowerCase().startsWith('tag:/');
  });

  readonly clickableLink = computed(() => {
    return clickableLink(this.ref().url);
  });

  readonly comments = computed(() => {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return pluginResponses(this.ref(), 'plugin/comment');
  });

  readonly responses = computed(() => {
    return this.ref().metadata?.responses || 0;
  });

  readonly sources = computed(() => {
    const sources = uniq(this.ref()?.sources).filter(s => s != this.ref().url);
    return sources.length || 0;
  });

  formatAuthor(user: string) {
    if (this.store.account.origin() && tagOrigin(user) === this.store.account.origin()) {
      user = user.replace(this.store.account.origin(), '');
    }
    return formatAuthor(user);
  }

  readonly mailboxes = computed(() => {
    return mailboxes(this.ref(), this.store.account.tag(), this.store.origins.originMap());
  });

  readonly replyTags = computed((): string[] => {
    const tags = [
      'plugin/comment',
      'internal',
      ...this.admin.reply().filter(p => hasTag(p.tag, this.ref())).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes(),
    ];
    return removeTag(getMailbox(this.store.account.tag(), this.store.account.origin()), uniq(tags));
  });

  saveRef() {
    this.store.view.preloadRef(this.ref(), this.repostRef());
  }

  download() {
    downloadRef(writeRef(this.ref()));
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
      if (a.scheme !== getScheme(this.repostRef()?.url || this.ref().url)) return false;
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

  save() {
    if (this.submitting()) return;
    this.submitted.set(true);
    this.editForm.markAllAsTouched();
    this.editor.syncEditor(this.fb, this.editForm);
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = DateTime.fromISO(this.editForm.value.published);
    this.submitting.set(true);
    this.submittingSubscription = this.refs.update({
      ...this.ref(),
      ...this.editForm.value,
      published,
      plugins: writePlugins(this.editForm.value.tags, {
        ...this.ref().plugins,
        ...this.editForm.value.plugins
      }),
    }).pipe(
      switchMap(() => this.refs.get(this.ref().url, this.ref().origin).pipe(takeUntilDestroyed(this.destroyRef))),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return of(undefined);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.submitting.set(false)),
    ).subscribe(ref => {
      if (!ref) return;
      this.editForm.reset();
      this.serverError.set([]);
      this.editing.set(false);
      this.ref.set(ref);
    });
  }

  cancelEdit() {
    this.submittingSubscription?.unsubscribe();
    this.editing.set(false);
  }

  toggleEditing() {
    if (this.editing()) this.cancelEdit();
    else this.editing.set(true);
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
    return (this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(this.ref()))
        : this.refs.delete(this.ref().url, this.ref().origin).pipe(map(() => ''))
    ).pipe(
      tap(() => this.deleted.set(true)),
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    );
  }

  protected goToComments() {
    this.router.navigate(['/ref', this.ref().url, 'comments'], { queryParams: { origin: this.nonLocalOrigin() } });
  }
}
