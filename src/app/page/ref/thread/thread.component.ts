import { Component, HostBinding, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, filter, of, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { CommentReplyComponent } from '../../../component/comment/comment-reply/comment-reply.component';
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
import { memo, MemoCache } from '../../../util/memo';
import { getArgs } from '../../../util/query';
import { hasTag, removeTag } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-ref-thread',
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss']
})
export class RefThreadComponent implements HasChanges {
  @HostBinding('class') css = 'thread';

  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  @ViewChild(CommentReplyComponent)
  reply?: CommentReplyComponent;
  @ViewChild(RefListComponent)
  list?: RefListComponent;

  newRefs$ = new Subject<Ref | undefined>();

  to = this.store.view.ref!;

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
      this.mod.setTitle($localize`Thread: ` + (this.store.view.ref?.title || this.store.view.url));
    }));
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      if (this.store.view.top && this.config.websockets) {
        this.watch?.unsubscribe();
        this.watch = this.stomp.watchResponse(this.store.view.top.url).pipe(
          takeUntil(this.destroy$),
          switchMap(url => this.refs.getCurrent(url)), // TODO: fix race conditions
          filter(ref => hasTag('plugin/thread', ref)),
          catchError(err => of(undefined)),
        ).subscribe(ref => this.newRefs$.next(ref));
      }
    }));
    this.disposers.push(autorun(() => {
      if (this.query.page) {
        this.to = this.query.page?.content?.[(this.query.page?.content?.length || 0) - 1] || this.store.view.ref!;
      }
    }));
    this.newRefs$.subscribe(c => {
      if (c && this.store.view.ref) {
        if (c.published! > this.to.published!) {
          this.to = c;
        }
        runInAction(() => {
          this.store.view.ref!.metadata ||= {};
          this.store.view.ref!.metadata.plugins ||= {} as any;
          this.store.view.ref!.metadata.plugins!['plugin/thread'] ||= 0;
          this.store.view.ref!.metadata.plugins!['plugin/thread']++;
        });
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  @memo
  get mailboxes() {
    return mailboxes(this.to, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replyExts() {
    return (this.to.tags || [])
      .map(tag => this.admin.getPlugin(tag))
      .flatMap(p => p?.config?.reply)
      .filter(t => !!t) as string[];
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      'internal',
      'plugin/thread',
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
      ...this.replyExts,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

}
