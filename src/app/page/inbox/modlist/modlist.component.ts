import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  standalone: false,
  selector: 'app-inbox-modlist',
  templateUrl: './modlist.component.html',
  styleUrls: ['./modlist.component.scss'],
  host: {'class': 'modlist'}
})
export class InboxModlistPage implements OnInit, OnDestroy, HasChanges {

  private disposers: IReactionDisposer[] = [];

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private router: Router,
  ) {
    mod.setTitle($localize`Inbox: Modlist`);
    store.view.clear(['modified']);
    query.clear();
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    if (!this.store.view.filter.length) {
      this.router.navigate([], { queryParams: { filter: ['query/!_moderated', 'query/public', 'query/!(_plugin:!+user)'] }, replaceUrl: true });
    }
    this.disposers.push(autorun(() => {
      const args = getArgs(
        this.store.account.origin || '*',
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
