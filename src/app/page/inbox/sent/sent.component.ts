import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  standalone: false,
  selector: 'app-inbox-sent',
  templateUrl: './sent.component.html',
  styleUrls: ['./sent.component.scss']
})
export class InboxSentPage implements OnInit, OnDestroy {
  @HostBinding('class') css = 'inbox-sent';

  private disposers: IReactionDisposer[] = [];

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: Sent`);
    store.view.clear();
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        this.store.account.tag + ':(plugin/inbox|plugin/outbox)',
        this.store.view.sort,
        this.store.view.filter.includes('query/plugin/delete') ? this.store.view.filter : ['query/!plugin/delete', ...this.store.view.filter],
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
