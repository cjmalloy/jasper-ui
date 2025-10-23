import { Component, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
    selector: 'app-ref-thread',
    templateUrl: './thread.component.html',
    styleUrls: ['./thread.component.scss'],
    host: { 'class': 'thread' },
    imports: [MobxAngularModule, RefListComponent, LoadingComponent, CommentReplyComponent]
})
export class RefThreadComponent implements HasChanges {

  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  @ViewChild(CommentReplyComponent)
  reply?: CommentReplyComponent;
  @ViewChild(RefListComponent)
  list?: RefListComponent;

  newRefs$ = new Subject<Ref | undefined>();

  to = this.store.view.ref!;

  private watchUrl = '';
  private watch?: Subscription;

  constructor(
    public config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private stomp: StompService,
    private refs: RefService,
  ) {
    query.clear();
    runInAction(() => store.view.defaultSort = ['published,ASC']);
  }

  saveChanges() {
    return (!this.reply || this.reply.saveChanges())
      && (!this.list || this.list.saveChanges());
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      if (this.store.view.pageSize) {
        runInAction(() => this.store.view.defaultPageNumber = Math.floor(((this.to.metadata?.plugins?.['plugin/thread'] || 1) - 1) / this.store.view.pageSize));
      }
    }));
    this.disposers.push(autorun(() => {
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
    }));
    this.disposers.push(autorun(() => {
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
    }));
    // TODO: set title for bare reposts
    this.disposers.push(autorun(() => this.mod.setTitle($localize`Thread: ` + getTitle(this.store.view.ref))));
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      if (this.store.view.ref && this.config.websockets) {
        const topUrl = top(this.store.view.ref);
        if (this.watchUrl !== topUrl) {
          this.watchUrl = topUrl;
          this.watch?.unsubscribe();
          this.watch = this.stomp.watchResponse(topUrl).pipe(
            switchMap(url => this.refs.getCurrent(url)), // TODO: fix race conditions
            tap(ref => runInAction(() => updateMetadata(this.store.view.ref!, ref))),
            filter(ref => hasTag('plugin/thread', ref)),
            catchError(err => of(undefined)),
            takeUntil(this.destroy$),
          ).subscribe(ref => this.newRefs$.next(ref));
        }
      }
    }));
    this.disposers.push(autorun(() => {
      if (this.query.page) {
        this.to = this.query.page?.content?.filter(ref => !hasTag('+plugin/placeholder', ref))?.[(this.query.page?.content?.length || 0) - 1] || this.store.view.ref!;
      }
    }));
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
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
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
