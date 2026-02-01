import { Component, effect, Injector, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';

import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
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
  imports: [ RefListComponent],
})
export class InboxRefPage implements OnInit, OnDestroy, HasChanges {

  @ViewChild('list')
  list?: RefListComponent;

  plugin?: Plugin;
  writeAccess = false;

  constructor(
    private injector: Injector,
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
    effect(() => {
      this.plugin = this.admin.getPlugin(this.store.view.inboxTag);
      this.mod.setTitle($localize`Inbox: ${this.plugin?.config?.inbox || this.store.view.inboxTag}`);
      const args = getArgs(
        this.store.view.inboxTag + (this.store.view.showRemotes ? '' : (this.plugin?.origin || '@')),
        this.store.view.sort,
        uniq(['!obsolete', ...this.store.view.filter]),
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }, { injector: this.injector });
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
