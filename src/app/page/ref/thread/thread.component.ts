import { ChangeDetectionStrategy, Component, effect, Injector, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';

import { catchError, filter, of, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CommentReplyComponent } from '../../../component/comment/comment-reply/comment-reply.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { StompService } from '../../../service/api/stomp.service';
import { ConfigService } from '../../../service/config.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getTitle } from '../../../util/format';
import { memo, MemoCache } from '../../../util/memo';
import { getArgs } from '../../../util/query';
import { hasTag, removeTag, top, updateMetadata } from '../../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ref-thread',
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss'],
  host: { 'class': 'thread' },
  imports: [ RefListComponent, LoadingComponent, CommentReplyComponent]
})
export class RefThreadComponent implements OnInit, OnDestroy, HasChanges {
  private destroy$ = new Subject<void>();

  @ViewChild('reply')
  reply?: CommentReplyComponent;
  @ViewChild('list')
  list?: RefListComponent;

  newRefs$ = new Subject<Ref | undefined>();

  to = this.store.view.ref!;

  private watchUrl = '';
  private watch?: Subscription;

  constructor(
    private injector: Injector,
    public config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private stomp: StompService,
    private refs: RefService,
  ) {
    query.clear();
    store.view.defaultSort = ['published,ASC'];
  }

  saveChanges() {
    return (!this.reply || this.reply.saveChanges())
      && (!this.list || this.list.saveChanges());
  }

  ngOnInit(): void {
    effect(() => {
      if (this.store.view.pageSize) {
        this.store.view.defaultPageNumber = Math.floor(((this.to.metadata?.plugins?.['plugin/thread'] || 1) - 1) / this.store.view.pageSize);
      }
    }, { injector: this.injector });
    effect(() => {
      const args = getArgs(
        'plugin/thread:!plugin/delete',
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.responses = this.store.view.url;
      defer(() => this.query.setArgs(args));
    }, { injector: this.injector });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Thread: ` + getTitle(this.store.view.ref)), { injector: this.injector });
    effect(() => {
      MemoCache.clear(this);
      if (this.store.view.ref) {
        const threadCount = this.store.view.ref.metadata?.plugins?.['plugin/thread'] || 0;
        this.store.local.setLastSeenCount(this.store.view.url, 'threads', threadCount);
      }
      if (this.store.view.ref && this.config.websockets) {
        const topUrl = top(this.store.view.ref);
        if (this.watchUrl !== topUrl) {
          this.watchUrl = topUrl;
          this.watch?.unsubscribe();
          this.watch = this.stomp.watchResponse(topUrl).pipe(
            switchMap(url => this.refs.getCurrent(url)),
            tap(ref => updateMetadata(this.store.view.ref!, ref)),
            filter(ref => hasTag('plugin/thread', ref)),
            catchError(err => of(undefined)),
            takeUntil(this.destroy$),
          ).subscribe(ref => this.newRefs$.next(ref));
        }
      }
    }, { injector: this.injector });
    effect(() => {
      if (this.query.page) {
        this.to = this.query.page?.content?.filter(ref => !hasTag('+plugin/placeholder', ref))?.[(this.query.page?.content?.length || 0) - 1] || this.store.view.ref!;
      }
    }, { injector: this.injector });
    this.newRefs$.subscribe(c => {
      if (c && this.store.view.ref) {
        if (hasTag('plugin/thread', c) && !hasTag('+plugin/placeholder', c) && c.published! > this.to.published!) {
          this.to = c;
        }
      }
    });
  }

  ngOnDestroy() {
    this.query.close();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @memo
  get thread() {
    return this.admin.getPlugin('plugin/thread') && hasTag('plugin/thread', this.store.view.ref);
  }

  @memo
  get mailboxes() {
    return mailboxes(this.to, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      'plugin/thread',
      'internal',
      ...this.admin.reply.filter(p => hasTag(p.tag, this.store.view.ref)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }
}
