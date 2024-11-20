import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { memo, MemoCache } from '../../../util/memo';
import { getArgs } from '../../../util/query';
import { hasTag, removeTag, top } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-ref-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class RefSummaryComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  newResp$ = new Subject<Ref | undefined>();
  newComment$ = new Subject<Ref | undefined>();
  newThread$ = new Subject<Ref | undefined>();

  summaryItems = 5;

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

  ngOnInit(): void {
    this.disposers.push(autorun(() => this.mod.setTitle((this.store.view.ref?.title || this.store.view.url))));
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      const top = this.store.view.ref!;
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
    return this.comments || this.threads || this.admin.responseButton.find(p => this.replyTags.includes(p.tag));
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.getComments(this.store.view.ref);
  }

  @memo
  get threads() {
    return this.getThreads(this.store.view.ref);
  }

  @memo
  get responses() {
    return this.getResponses(this.store.view.ref);
  }

  @memo
  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }

  @memo
  get replyExts() {
    return (this.store.view.ref?.tags || [])
      .map(tag => this.admin.getPlugin(tag))
      .flatMap(p => p?.config?.reply)
      .filter(t => !!t) as string[];
  }

  @memo
  get replyTags(): string[] {
    const tags = [
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
      ...this.replyExts,
    ];
    if (this.comments) tags.push('plugin/comment', 'internal');
    if (this.threads) tags.push('plugin/thread', 'internal');
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  get moreComments() {
    const topComments = this.thread.cache.get(this.top);
    if (!topComments) return false;
    return topComments.length > this.summaryItems;
  }

  private getComments(r?: Ref) {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return r?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  private getThreads(r?: Ref) {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return r?.metadata?.plugins?.['plugin/thread'] || 0;
  }

  private getResponses(r?: Ref) {
    return r?.metadata?.responses || 0;
  }

  onReply(ref?: Ref) {
    runInAction(() => {
      if (ref && this.store.view.ref) {
        MemoCache.clear(this);
        this.store.view.ref.metadata ||= {};
        this.store.view.ref.metadata.plugins ||= {} as any;
        if (hasTag('plugin/comment', ref)) {
          this.store.view.ref.metadata.plugins!['plugin/comment'] ||= 0;
          this.store.view.ref.metadata.plugins!['plugin/comment']++;
        }
        if (hasTag('plugin/thread', ref)) {
          this.store.view.ref.metadata.plugins!['plugin/thread'] ||= 0;
          this.store.view.ref.metadata.plugins!['plugin/thread']++;
        }
        if (hasTag('internal', ref)) {
          this.store.view.ref.metadata.internalResponses ||= 0;
          this.store.view.ref.metadata.internalResponses++;
        } else {
          this.store.view.ref.metadata.responses ||= 0;
          this.store.view.ref.metadata.responses++;
        }
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
