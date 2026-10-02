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
  viewChildren,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../../directive/title.directive';
import { Ref } from '../../../model/ref';
import { deleteNotice } from '../../../mods/delete';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { ConfigService } from '../../../service/config.service';
import { Store } from '../../../store/store';
import { authors, clickableLink, formatAuthor, getNiceTitle } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag, localTag, repost, tagOrigin } from '../../../util/tag';
import { ActionComponent } from '../../action/action.component';
import { ConfirmActionComponent } from '../../action/confirm-action/confirm-action.component';
import { InlineTagComponent } from '../../action/inline-tag/inline-tag.component';
import { LoadingComponent } from '../../loading/loading.component';
import { MdComponent } from '../../md/md.component';
import { NavComponent } from '../../nav/nav.component';
import { ViewerComponent } from '../../viewer/viewer.component';

@Component({
  selector: 'app-chat-entry',
  templateUrl: './chat-entry.component.html',
  styleUrls: ['./chat-entry.component.scss'],
  host: { 'class': 'chat-entry', '[attr.tabindex]': '0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FakeLinkDirective,
    forwardRef(() => ViewerComponent),
    forwardRef(() => MdComponent),
    RouterLink,
    TitleDirective,
    LoadingComponent,
    NavComponent,
    ConfirmActionComponent,
    InlineTagComponent,
    AsyncPipe,
  ],
})
export class ChatEntryComponent {
  private destroyRef = inject(DestroyRef);

  readonly actionComponents = viewChildren<ActionComponent>('action');

  readonly refInput = input.required<Ref>({ alias: 'ref' });
  private readonly refSignal = linkedSignal(() => this.refInput());
  get ref() { return this.refSignal(); }
  set ref(value: Ref) { this.refSignal.set(value); }
  readonly focused = input(false);
  readonly loading = input(true);

  private readonly noCommentSignal = signal<Ref>({} as any);
  private readonly repostRefSignal = signal<Ref | undefined>(undefined);
  private readonly deletedSignal = signal(false);
  private readonly writeAccessSignal = signal(false);
  private readonly taggingAccessSignal = signal(false);
  private readonly deleteAccessSignal = signal(false);
  private readonly serverErrorSignal = signal<string[]>([]);
  private readonly allowActionsSignal = signal(false);

  get noComment() { return this.noCommentSignal(); }
  set noComment(value: Ref) { this.noCommentSignal.set(value); }
  get repostRef() { return this.repostRefSignal(); }
  set repostRef(value: Ref | undefined) { this.repostRefSignal.set(value); }
  get deleted() { return this.deletedSignal(); }
  set deleted(value: boolean) { this.deletedSignal.set(value); }
  get writeAccess() { return this.writeAccessSignal(); }
  set writeAccess(value: boolean) { this.writeAccessSignal.set(value); }
  get taggingAccess() { return this.taggingAccessSignal(); }
  set taggingAccess(value: boolean) { this.taggingAccessSignal.set(value); }
  get deleteAccess() { return this.deleteAccessSignal(); }
  set deleteAccess(value: boolean) { this.deleteAccessSignal.set(value); }
  get serverError() { return this.serverErrorSignal(); }
  set serverError(value: string[]) { this.serverErrorSignal.set(value); }

  constructor(
    private config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private exts: ExtService,
    private ts: TaggingService,
    private refs: RefService,
  ) {
    effect(() => {
      this.refInput();
      untracked(() => this.init());
    });
    effect(() => {
      if (!this.focused() && !this.allowActionsSignal()) this.actionComponents()?.forEach(c => c.reset());
    });
  }

  init() {
    this.actionComponents()?.forEach(c => c.reset());
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.deleteAccess = this.auth.deleteAccess(this.ref);
    if (this.bareRepost && this.ref && this.repostRef?.url != repost(this.ref)) {
      (this.store.view.top?.url === this.ref.sources![0]
          ? of(this.store.view.top)
          : this.refs.getCurrent(this.url)
      ).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(ref => {
        this.repostRef = ref;
        if (!ref) return;
        this.noComment = {
          ...ref,
          comment: '',
        };
      });
    } else {
      this.noComment = {
        ...this.ref,
        comment: '',
      };
    }
  }

  get title() {
    const title = (this.ref?.title || '').trim();
    if (title) return title;
    if (this.focused()) return '';
    if (this.bareRepost) return getNiceTitle(this.repostRef) || '';
    return getNiceTitle(this.ref);
  }

  get allowActions(): boolean {
    return this.allowActionsSignal() || this.focused() || !!this.actionComponents()?.find(c => c.active());
  }

  set allowActions(value: boolean) {
    if (value === this.allowActionsSignal()) return;
    if (value) {
      defer(() => this.allowActionsSignal.set(value));
    } else {
      this.allowActionsSignal.set(false);
    }
  }

  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  get localhost() {
    return this.ref.url.startsWith(this.config.base);
  }

  get authors() {
    const lookup = this.store.origins.originMap.get(this.ref.origin || '');
    return uniq([
      ...this.ref.tags?.filter(t => this.admin.getPlugin(t)?.config?.signature === t) || [],
      ...authors(this.ref).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  }

  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  get tagLink() {
    return this.url.toLowerCase().startsWith('tag:/');
  }

  get clickableLink() {
    return clickableLink(this.url);
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

  get repost() {
    return this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref);
  }

  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  get approved() {
    return hasTag('_moderated', this.currentRef);
  }

  get locked() {
    return hasTag('locked', this.currentRef);
  }

  get qr() {
    return hasTag('plugin/qr', this.currentRef);
  }

  get audio() {
    return hasTag('plugin/audio', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/audio');
  }

  get video() {
    return hasTag('plugin/video', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/image');
  }

  get image() {
    return hasTag('plugin/image', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/image');
  }

  get media() {
    return this.qr || this.audio || this.video || this.image;
  }

  get expand() {
    return this.currentRef?.comment || this.media;
  }

  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get chatroom() {
    return this.admin.getPlugin('plugin/chat') && hasTag('plugin/chat', this.ref);
  }

  get thread() {
    if (!this.admin.getPlugin('plugin/thread')) return '';
    if (!hasTag('plugin/thread', this.ref) && !this.threads) return '';
    return this.ref.sources?.[1] || this.ref.sources?.[0] || this.ref.url;
  }

  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.ref.metadata?.plugins?.['plugin/thread'] || 0;
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  saveRef() {
    this.store.view.preloadRef(this.ref, this.repostRef);
  }

  tag$ = (tag: string) => {
    this.serverError = [];
    return this.store.eventBus.runAndReload$(this.ts.create(tag, this.ref.url, this.ref.origin!), this.ref);
  }

  approve() {
    this.refs.patch(this.ref.url, this.ref.origin!, this.ref.modifiedString!, [{
      op: 'add',
      path: '/tags/-',
      value: '_moderated',
    }]).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!).pipe(takeUntilDestroyed(this.destroyRef))),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
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

}
