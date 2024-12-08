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
  selector: 'app-inbox-dms',
  templateUrl: './dms.component.html',
  styleUrls: ['./dms.component.scss']
})
export class InboxDmsPage implements OnInit, OnDestroy {
  @HostBinding('class') css = 'dms';

  private disposers: IReactionDisposer[] = [];

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: DMs`);
    store.view.clear(['metadataModified']);
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        `dm:!plugin/thread:(${this.store.account.tag}|${this.store.account.inboxQuery})`,
        this.store.view.sort,
        this.store.view.filter.includes('query/plugin/delete') ? [...this.store.view.filter] : ['query/!plugin/delete', ...this.store.view.filter],
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
