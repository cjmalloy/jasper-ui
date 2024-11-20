import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  standalone: false,
  selector: 'app-inbox-modlist',
  templateUrl: './modlist.component.html',
  styleUrls: ['./modlist.component.scss']
})
export class InboxModlistPage implements OnInit, OnDestroy {
  @HostBinding('class') css = 'modlist';

  private disposers: IReactionDisposer[] = [];

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
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
