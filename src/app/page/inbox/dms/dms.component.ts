import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-dms',
  templateUrl: './dms.component.html',
  styleUrls: ['./dms.component.scss']
})
export class InboxDmsPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    theme.setTitle($localize`Inbox: DMs`);
    store.view.clear('modified');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        `dm:(${this.store.account.tag}|${this.store.account.inboxQuery})`,
        this.store.view.sort,
        this.store.view.filter.includes('query/plugin/delete') ? ['unsourced', ...this.store.view.filter] : ['query/!plugin/delete', ...this.store.view.filter],
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
