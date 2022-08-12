import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss'],
})
export class InboxAllPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    theme.setTitle('Inbox: All');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.query.setArgs(getArgs(
        this.store.account.inbox,
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize ?? this.defaultPageSize
      ));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
