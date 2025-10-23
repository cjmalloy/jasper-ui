import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
    imports: [MobxAngularModule, RefListComponent],
})
export class InboxRefPage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  @ViewChild(RefListComponent)
  list?: RefListComponent;

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

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
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
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
