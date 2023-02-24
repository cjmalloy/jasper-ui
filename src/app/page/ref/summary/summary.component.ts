import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer, flatten, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject } from 'rxjs';
import { Ref } from '../../../model/ref';
import { mailboxes } from '../../../plugin/mailbox';
import { AdminService } from '../../../service/admin.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { ThreadStore } from '../../../store/thread';
import { getArgs } from '../../../util/query';

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
    public store: Store,
    public thread: ThreadStore,
    public query: QueryStore,
  ) {
    query.clear();
    thread.clear();
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
        uniq(['query/!internal@*', ...this.store.view.filter]),
        this.store.view.search,
        this.store.view.pageNumber,
        this.summaryItems,
      );
      args.responses = this.store.view.url;
      defer(() => this.query.setArgs(args));
    }));
    this.newComments$.subscribe(() => runInAction(() => {
      if (!this.comments) {
        runInAction(() => {
          this.store.view.ref!.metadata ||= {};
          this.store.view.ref!.metadata.plugins ||= {};
          this.store.view.ref!.metadata.plugins['plugin/comment'] ||= 0;
          this.store.view.ref!.metadata.plugins['plugin/comment']++;
        });
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.newComments$.complete();
  }

  getComments(r?: Ref) {
    if (!this.admin.status.plugins.comment) return 0;
    return r?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get comments() {
    if (!this.admin.status.plugins.comment) return 0;
    return this.getComments(this.store.view.ref);
  }

  get responses() {
    return this.store.view.ref?.metadata?.responses || 0;
  }

  get mailboxes() {
    return mailboxes(this.store.view.ref!, this.store.account.tag, this.store.origins.originMap);
  }

  get moreComments() {
    const topComments = this.thread.cache.get(this.thread.top?.url);
    if (!topComments) return false;
    return topComments.length > this.summaryItems;
  }
}
