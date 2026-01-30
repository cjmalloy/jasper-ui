import { Component, effect, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';

import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-inbox-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss'],
  host: { 'class': 'inbox-all' },
  imports: [ RefListComponent]
})
export class InboxAllPage implements OnDestroy, HasChanges {

  @ViewChild('list')
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private router: Router,
  ) {
    mod.setTitle($localize`Inbox: All`);
    store.view.clear(['modified']);
    query.clear();

    if (!this.store.view.filter.length) {
      this.router.navigate([], { queryParams: { filter: ['query/!(dm)'] }, replaceUrl: true });
    }

    // Effect for query args
    effect(() => {
      const args = getArgs(
        this.store.account.inboxQuery,
        this.store.view.sort,
        ['query/!plugin/delete', 'user/!plugin/user/hide', ...this.store.view.filter],
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    });
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
