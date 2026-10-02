import {
  AsyncPipe
} from '@angular/common';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  inject,
  Component,
  forwardRef,
  ChangeDetectionStrategy,
  effect,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  viewChildren
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { defer, groupBy, intersection, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, map, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
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
import { findArchive } from '../../../mods/tools/archive';
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
import { scrollToFirstInvalid } from '../../../util/form';
import { authors, clickableLink, formatAuthor, interestingTags } from '../../../util/format';
import { getScheme, printError } from '../../../util/http';
import { hasTag, isAuthorTag, localTag, removeTag, repost, tagOrigin } from '../../../util/tag';
import { ActionListComponent } from '../../action/action-list/action-list.component';
import { ActionComponent } from '../../action/action.component';
import { ConfirmActionComponent } from '../../action/confirm-action/confirm-action.component';
import { InlineTagComponent } from '../../action/inline-tag/inline-tag.component';
import { LoadingComponent } from '../../loading/loading.component';
import { NavComponent } from '../../nav/nav.component';
import { ViewerComponent } from '../../viewer/viewer.component';
import { CommentReplyComponent } from '../../comment/comment-reply/comment-reply.component';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { ThreadSummaryComponent } from '../../comment/thread-summary/thread-summary.component';

@Component({
  selector: 'app-blog-entry',
  templateUrl: './blog-entry.component.html',
  styleUrls: ['./blog-entry.component.scss'],
  host: { 'class': 'blog-entry', '[attr.tabindex]': '0', '[class.deleted]': 'deleted' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    AsyncPipe,
  ],
})
export class BlogEntryComponent implements HasChanges {
  private destroyRef = inject(DestroyRef);

  readonly actionComponents = viewChildren<ActionComponent>('action');
  readonly refForm = viewChild<RefFormComponent>('refForm');

  readonly blog = input<Ext>();
  readonly refInput = input.required<Ref>({ alias: 'ref' });
  private readonly refSignal = linkedSignal(() => this.refInput());
  get ref() { return this.refSignal(); }
  set ref(value: Ref) { this.refSignal.set(value); }

  private readonly repostRefSignal = signal<Ref | undefined>(undefined);
  get repostRef() { return this.repostRefSignal(); }
  set repostRef(value: Ref | undefined) { this.repostRefSignal.set(value); }

  editForm: UntypedFormGroup;
  private readonly submittedSignal = signal(false);
  private readonly iconsSignal = signal<Icon[]>([]);
  private readonly actionsSignal = signal<Action[]>([]);
  private readonly groupedActionsSignal = signal<{ [key: string]: Action[] }>({});
  private readonly editingSignal = signal(false);
  private readonly viewSourceSignal = signal(false);
  get deleted() { return this.deletedSignal(); }
  private readonly deletedSignal = signal(false);
  private readonly writeAccessSignal = signal(false);
  private readonly taggingAccessSignal = signal(false);
  private readonly deleteAccessSignal = signal(false);
  private readonly replyingSignal = signal(false);
  private readonly serverErrorSignal = signal<string[]>([]);

  private readonly submittingSignal = signal<Subscription | undefined>(undefined);

  get submitted() { return this.submittedSignal(); }
  set submitted(value: boolean) { this.submittedSignal.set(value); }

  get icons() { return this.iconsSignal(); }
  set icons(value: Icon[]) { this.iconsSignal.set(value); }

  get actions() { return this.actionsSignal(); }
  set actions(value: Action[]) { this.actionsSignal.set(value); }

  get groupedActions() { return this.groupedActionsSignal(); }
  set groupedActions(value: { [key: string]: Action[] }) { this.groupedActionsSignal.set(value); }

  get editing() { return this.editingSignal(); }
  set editing(value: boolean) { this.editingSignal.set(value); }

  get viewSource() { return this.viewSourceSignal(); }
  set viewSource(value: boolean) { this.viewSourceSignal.set(value); }

  set deleted(value: boolean) { this.deletedSignal.set(value); }

  get writeAccess() { return this.writeAccessSignal(); }
  set writeAccess(value: boolean) { this.writeAccessSignal.set(value); }

  get taggingAccess() { return this.taggingAccessSignal(); }
  set taggingAccess(value: boolean) { this.taggingAccessSignal.set(value); }

  get deleteAccess() { return this.deleteAccessSignal(); }
  set deleteAccess(value: boolean) { this.deleteAccessSignal.set(value); }

  get replying() { return this.replyingSignal(); }
  set replying(value: boolean) { this.replyingSignal.set(value); }

  get serverError() { return this.serverErrorSignal(); }
  set serverError(value: string[]) { this.serverErrorSignal.set(value); }

  get submitting() { return this.submittingSignal(); }
  set submitting(value: Subscription | undefined) { this.submittingSignal.set(value); }

  summaryItems = 5;

  constructor(
    private config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private bookmarks: BookmarkService,
    private ts: TaggingService,
    private router: Router,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = refForm(fb);
    effect(() => {
      this.refInput();
      untracked(() => this.init());
    });
    effect(() => {
      const value = this.refForm();
      const ref = this.ref;
      defer(() => {
        value?.setRef(ref);
        this.editor.syncEditor(this.fb, this.editForm, ref.comment);
      });
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
  }

  saveChanges() {
    return !this.editing || !this.editForm.dirty;
  }

  init() {
    this.submitted = false;
    this.deleted = false;
    this.editing = false;
    this.viewSource = false;
    this.actionComponents()?.forEach(c => c.reset());
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.deleteAccess = this.auth.deleteAccess(this.ref);
    this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
    this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));
    this.groupedActions = groupBy(this.actions.filter(a => this.showAction(a)), a => (a as any)[this.label(a)]);
    if (this.repost && this.ref && this.repostRef?.url != repost(this.ref)) {
      (this.store.view.top?.url === this.ref.sources![0]
          ? of(this.store.view.top)
          : this.refs.getCurrent(this.url)
      ).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(ref => this.repostRef = ref);
    }
  }

  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  get repost() {
    return this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref);
  }

  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  get currentRef() {
    return this.repost ? this.repostRef : this.ref;
  }

  get bareRef() {
    return this.bareRepost ? this.repostRef : this.ref;
  }

  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  get title(): string {
    const title = (this.ref.title || '').trim();
    const comment = (this.ref.comment || '').trim();
    if (title) return title;
    if (!comment) return this.ref.url;
    if (comment.length <= 140) return comment;
    return comment.substring(0, 140);
  }

  get canInvoice() {
    if (!this.local) return false;
    if (!this.admin.getPlugin('plugin/invoice')) return false;
    if (!this.isAuthor) return false;
    return hasTag('queue', this.ref);
  }

  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  get localhost() {
    return this.ref.url.startsWith(this.config.base);
  }

  get pdf() {
    if (!this.admin.getPlugin('plugin/pdf')) return null;
    return this.ref.plugins?.['plugin/pdf']?.url || this.findPdf;
  }

  get findPdf() {
    if (!this.ref.alternateUrls) return null;
    for (const s of this.ref.alternateUrls) {
      if (new URL(s).pathname.endsWith('.pdf')) {
        return s;
      }
    }
    return null;
  }

  get archive() {
    const plugin = this.admin.getPlugin('plugin/archive');
    if (!plugin) return null;
    return this.ref.plugins?.['plugin/archive']?.url || findArchive(plugin, this.ref);
  }

  get isAuthor() {
    return isAuthorTag(this.store.account.tag, this.ref);
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

  get tags() {
    let result = interestingTags(this.ref.tags);
    const blog = this.blog();
    if (!blog?.config?.filterTags) return result;
    return intersection(result, blog.config.tags || []);
  }

  get tagExts$() {
    return this.editor.getTagsPreview(this.tags, this.ref.origin || '');
  }

  get tagLink() {
    return this.url.toLowerCase().startsWith('tag:/');
  }

  get clickableLink() {
    return clickableLink(this.ref.url);
  }

  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get responses() {
    return this.ref.metadata?.responses || 0;
  }

  get sources() {
    const sources = uniq(this.ref?.sources).filter(s => s != this.ref.url);
    return sources.length || 0;
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  get mailboxes() {
    return mailboxes(this.ref, this.store.account.tag, this.store.origins.originMap);
  }

  get replyTags(): string[] {
    const tags = [
      'plugin/comment',
      'internal',
      ...this.admin.reply.filter(p => hasTag(p.tag, this.ref)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  saveRef() {
    this.store.view.preloadRef(this.ref, this.repostRef);
  }

  download() {
    downloadRef(writeRef(this.ref));
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

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    this.editor.syncEditor(this.fb, this.editForm);
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = DateTime.fromISO(this.editForm.value.published);
    this.submitting = this.refs.update({
      ...this.ref,
      ...this.editForm.value,
      published,
      plugins: writePlugins(this.editForm.value.tags, {
        ...this.ref.plugins,
        ...this.editForm.value.plugins
      }),
    }).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin).pipe(takeUntilDestroyed(this.destroyRef))),
      catchError((err: HttpErrorResponse) => {
        this.submitting = undefined;
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.editForm.reset();
      this.submitting = undefined;
      this.serverError = [];
      this.editing = false;
      this.ref = ref;
      this.init();
    });
  }

  forceDelete$ = () => {
    this.serverError = [];
    return this.refs.delete(this.ref.url, this.ref.origin).pipe(
      tap(() => this.deleted = true),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  delete$ = () => {
    this.serverError = [];
    return (this.admin.getPlugin('plugin/delete')
        ? this.refs.update(deleteNotice(this.ref))
        : this.refs.delete(this.ref.url, this.ref.origin).pipe(map(() => ''))
    ).pipe(
      tap(() => this.deleted = true),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    );
  }

  protected goToComments() {
    this.router.navigate(['/ref', this.ref.url, 'comments'], { queryParams: { origin: this.nonLocalOrigin } });
  }
}
