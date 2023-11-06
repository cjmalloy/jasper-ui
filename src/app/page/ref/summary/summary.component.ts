import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { getMailbox, mailboxes } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { interestingTags } from '../../../util/format';
import { getArgs } from '../../../util/query';
import { hasTag, removeTag } from '../../../util/tag';

@Component({
  selector: 'app-ref-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class RefSummaryComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  newComments$ = new Subject<Ref | null>();

  summaryItems = 5;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public refs: RefService,
    public store: Store,
    public thread: ThreadStore,
    public query: QueryStore,
  ) {
    query.clear();
    thread.clear();
    runInAction(() => store.view.defaultSort = 'modified,DESC');
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => this.theme.setTitle((this.store.view.ref?.title || this.store.view.url))));
    this.disposers.push(autorun(() => {
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
        uniq(['query/!internal', ...this.store.view.filter]),
        this.store.view.search,
        this.store.view.pageNumber,
        this.summaryItems,
      );
      args.responses = this.store.view.url;
      defer(() => this.query.setArgs(args));
    }));
    this.newComments$.subscribe(c => runInAction(() => {
      if (c && this.store.view.ref) {
        this.store.view.ref.metadata ||= {};
        this.store.view.ref.metadata.plugins ||= {} as any;
        if (hasTag('plugin/comment', c)) {
          this.store.view.ref.metadata.plugins!['plugin/comment'] ||= 0;
          this.store.view.ref.metadata.plugins!['plugin/comment']++;
        }
        if (hasTag('plugin/thread', c)) {
          this.store.view.ref.metadata.plugins!['plugin/thread'] ||= 0;
          this.store.view.ref.metadata.plugins!['plugin/thread']++;
        }
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.newComments$.complete();
  }

  get top() {
    if (hasTag('plugin/comment', this.store.view.ref)) {
      return this.store.view.ref?.sources?.[1] || this.store.view.ref?.sources?.[0];
    }
    return this.store.view.ref?.url;
  }

  getComments(r?: Ref) {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return r?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  getThreads(r?: Ref) {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return r?.metadata?.plugins?.['plugin/thread'] || 0;
  }

  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.getComments(this.store.view.ref);
  }

  get threads() {
    return this.getThreads(this.store.view.ref);
  }

  get responses() {
    return this.store.view.ref?.metadata?.responses || 0;
  }

  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }

  get replyTags(): string[] {
    const tags = [
      'internal',
      ...this.admin.reply.filter(p => (this.store.view.ref?.tags || []).includes(p.tag)).flatMap(p => p.config!.reply as string[]),
      ...this.mailboxes,
    ];
    if (hasTag('public', this.store.view.ref)) tags.unshift('public');
    if (hasTag('plugin/email', this.store.view.ref)) {
      tags.push('plugin/email');
      tags.push('plugin/thread')
    } else if (hasTag('plugin/thread', this.store.view.ref)) {
      tags.push('plugin/thread');
    } else {
      tags.push('plugin/comment');
    }
    return removeTag(getMailbox(this.store.account.tag, this.store.account.origin), uniq(tags));
  }

  get moreComments() {
    const topComments = this.thread.cache.get(this.top);
    if (!topComments) return false;
    return topComments.length > this.summaryItems;
  }
}
