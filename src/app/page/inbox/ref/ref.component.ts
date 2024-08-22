import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-inbox-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class InboxRefPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  plugin?: Plugin;
  writeAccess = false;

  constructor(
    private mod: ModService,
    private admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: `);
    store.view.clear(['modified']);
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.plugin = this.admin.getPlugin(this.store.view.childTag);
      this.mod.setTitle($localize`Inbox: ${this.plugin?.config?.inbox || this.store.view.childTag}`);
      const args = getArgs(
        this.store.view.childTag + (this.store.view.showRemotes ? '' : (this.plugin?.origin || '@')),
        this.store.view.sort,
        uniq(['obsolete', ...this.store.view.filter]),
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
