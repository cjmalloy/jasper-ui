import { Component, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { Subject } from 'rxjs';
import { CommentReplyComponent } from '../../../component/comment/comment-reply/comment-reply.component';
import { CommentThreadComponent } from '../../../component/comment/comment-thread/comment-thread.component';
import { ThreadSummaryComponent } from '../../../component/comment/thread-summary/thread-summary.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';

import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { getTitle } from '../../../util/format';
import { memo, MemoCache } from '../../../util/memo';
import { getArgs } from '../../../util/query';
import { hasTag, removeTag, top, updateMetadata } from '../../../util/tag';

@Component({
    selector: 'app-ref-summary',
    templateUrl: './summary.component.html',
    styleUrls: ['./summary.component.scss'],
    imports: [MobxAngularModule, CommentReplyComponent, RouterLink, ThreadSummaryComponent, RefListComponent, LoadingComponent]
})
export class RefSummaryComponent implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];
  newResp$ = new Subject<Ref | undefined>();
  newComment$ = new Subject<Ref | undefined>();
  newThread$ = new Subject<Ref | undefined>();

  summaryItems = 5;

  @ViewChild(CommentReplyComponent)
  reply?: CommentReplyComponent;
  @ViewChildren(CommentThreadComponent)
  threadComponents?: QueryList<CommentThreadComponent>;
  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public refs: RefService,
    public store: Store,
    public thread: ThreadStore,
    public query: QueryStore,
  ) {
    query.clear();
    thread.clear();
    runInAction(() => store.view.defaultSort = ['modified,DESC']);
  }

  saveChanges() {
    return (!this.reply || this.reply.saveChanges())
      && (!this.list || this.list.saveChanges())
      && !this.threadComponents?.find(t => !t.saveChanges());
  }

  ngOnInit(): void {
    // TODO: set title for bare reposts
    this.disposers.push(autorun(() => this.mod.setTitle(getTitle(this.store.view.ref))));
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      const top = this.store.view.url;
      const sort = this.store.view.sort;
      const filter = this.store.view.filter;
      const search = this.store.view.search;
      runInAction(() => this.thread.setArgs(top, sort, filter, search));
    }));
    this.disposers.push(autorun(() => {
      const args = getArgs(
        '',
        this.store.view.sort,
        uniq(['query/!internal', 'query/!plugin/comment', 'query/!plugin/thread', ...this.store.view.filter]),
        this.store.view.search,
        this.store.view.pageNumber,
        this.summaryItems,
      );
      args.responses = this.store.view.url;
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.newResp$.complete();
    this.newComment$.complete();
    this.newThread$.complete();
  }

  @memo
  get top() {
    return top(this.store.view.ref);
  }

  @memo
  get responseSet() {
    return this.comments || this.threads || this.admin.responseButton.find(p => hasTag(p.tag, this.replyTags));
  }

  @memo
  get dm() {
    return !!this.admin.getTemplate('dm') && hasTag('dm', this.store.view.ref);
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.store.view.ref?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return this.store.view.ref?.metadata?.plugins?.['plugin/thread'] || 0;
  }

  @memo
  get responses() {
    return this.store.view.ref?.metadata?.responses || 0;
  }

  @memo
  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      ...this.comments ? ['plugin/comment'] : this.threads ? ['plugin/thread'] : [],
      ...this.admin.reply.filter(p => hasTag(p.tag, this.store.view.ref)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  get moreComments() {
    const topComments = this.thread.cache.get(this.top);
    if (!topComments) return false;
    return topComments.length > this.summaryItems;
  }

  onReply(ref?: Ref) {
    runInAction(() => {
      if (ref && this.store.view.ref) {
        MemoCache.clear(this);
        runInAction(() => updateMetadata(this.store.view.ref!, ref));
      }
    });
    this.store.eventBus.reload(ref);
    if (hasTag('plugin/comment', ref)) {
      this.newComment$?.next(ref);
    } else if (hasTag('plugin/thread', ref)) {
      this.newThread$?.next(ref);
    } else if (!hasTag('internal', ref)) {
      this.newResp$?.next(ref);
    }

  }
}
