import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component, forwardRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { catchError, map, of, Subject, switchMap, takeUntil, throwError } from 'rxjs';
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
import { memo, MemoCache } from '../../../util/memo';
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
  host: { 'class': 'chat-entry' },
  imports: [
    forwardRef(() => ViewerComponent),
    MdComponent,
    RouterLink,
    TitleDirective,
    LoadingComponent,
    NavComponent,
    ConfirmActionComponent,
    InlineTagComponent,
    AsyncPipe,
  ],
})
export class ChatEntryComponent implements OnChanges, OnDestroy {
  @HostBinding('attr.tabindex') tabIndex = 0;
  private destroy$ = new Subject<void>();

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  ref!: Ref;
  @Input()
  focused = false;
  @Input()
  loading = true;

  noComment: Ref = {} as any;
  repostRef?: Ref;
  deleted = false;
  writeAccess = false;
  taggingAccess = false;
  deleteAccess = false;
  serverError: string[] = [];

  private _allowActions = false;

  constructor(
    private config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private exts: ExtService,
    private ts: TaggingService,
    private refs: RefService,
  ) { }

  init() {
    MemoCache.clear(this);
    this.actionComponents?.forEach(c => c.reset());
    this.writeAccess = this.auth.writeAccess(this.ref);
    this.taggingAccess = this.auth.taggingAccess(this.ref);
    this.deleteAccess = this.auth.deleteAccess(this.ref);
    if (this.bareRepost && this.ref && this.repostRef?.url != repost(this.ref)) {
      (this.store.view.top?.url === this.ref.sources![0]
          ? of(this.store.view.top)
          : this.refs.getCurrent(this.url)
      ).pipe(
        catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
        takeUntil(this.destroy$),
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

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) {
      this.init();
    } else if (changes.focused) {
      MemoCache.clear(this);
      if (!this.focused && !this._allowActions) this.actionComponents?.forEach(c => c.reset());
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @memo
  get title() {
    const title = (this.ref?.title || '').trim();
    if (title) return title;
    if (this.focused) return '';
    if (this.bareRepost) return getNiceTitle(this.repostRef) || $localize`Repost`;
    return getNiceTitle(this.ref);
  }

  get allowActions(): boolean {
    return this._allowActions || this.focused || !!this.actionComponents?.find(c => c.active());
  }

  set allowActions(value: boolean) {
    if (value === this._allowActions) return;
    if (value) {
      defer(() => this._allowActions = value);
    } else {
      this._allowActions = false;
    }
  }

  @memo
  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  @memo
  get localhost() {
    return this.ref.url.startsWith(this.config.base);
  }

  @memo
  get authors() {
    const lookup = this.store.origins.originMap.get(this.ref.origin || '');
    return uniq([
      ...this.ref.tags?.filter(t => this.admin.getPlugin(t)?.config?.signature === t) || [],
      ...authors(this.ref).map(a => !tagOrigin(a) ? a : localTag(a) + (lookup?.get(tagOrigin(a)) ?? tagOrigin(a))),
    ]);
  }

  @memo
  get authorExts$() {
    return this.exts.getCachedExts(this.authors, this.ref.origin || '').pipe(this.admin.authorFallback);
  }

  @memo
  get tagLink() {
    return this.url.toLowerCase().startsWith('tag:/');
  }

  @memo
  get clickableLink() {
    return clickableLink(this.url);
  }

  @memo
  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  @memo
  get currentRef() {
    return this.repost ? this.repostRef : this.ref;
  }

  @memo
  get bareRef() {
    return this.bareRepost ? this.repostRef : this.ref;
  }

  @memo
  get repost() {
    return this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref);
  }

  @memo
  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  @memo
  get approved() {
    return hasTag('_moderated', this.currentRef);
  }

  @memo
  get locked() {
    return hasTag('locked', this.currentRef);
  }

  @memo
  get qr() {
    return hasTag('plugin/qr', this.currentRef);
  }

  @memo
  get audio() {
    return hasTag('plugin/audio', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/audio');
  }

  @memo
  get video() {
    return hasTag('plugin/video', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/image');
  }

  @memo
  get image() {
    return hasTag('plugin/image', this.currentRef) ||
      this.admin.getPluginsForUrl(this.url).find(p => p.tag === 'plugin/image');
  }

  @memo
  get media() {
    return this.qr || this.audio || this.video || this.image;
  }

  @memo
  get expand() {
    return this.currentRef?.comment || this.media;
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get chatroom() {
    return this.admin.getPlugin('plugin/chat') && hasTag('plugin/chat', this.ref);
  }

  @memo
  get thread() {
    if (!this.admin.getPlugin('plugin/thread')) return '';
    if (!hasTag('plugin/thread', this.ref) && !this.threads) return '';
    return this.ref.sources?.[1] || this.ref.sources?.[0] || this.ref.url;
  }

  @memo
  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.ref.metadata?.plugins?.['plugin/thread'] || 0;
  }

  @memo
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
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!).pipe(takeUntil(this.destroy$))),
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
