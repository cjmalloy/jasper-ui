import { Component, effect, OnDestroy, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';

import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-inbox-alarms',
  templateUrl: './alarms.component.html',
  styleUrls: ['./alarms.component.scss'],
  host: { 'class': 'alarms' },
  imports: [ RefListComponent]
})
export class InboxAlarmsPage implements OnDestroy, HasChanges {

  @ViewChild('list')
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: Alarms`);
    store.view.clear(['modified']);
    query.clear();

    effect(() => {
      const args = getArgs(
        this.store.account.alarms.length ? this.store.account.alarms.join('|') : '!@*',
        this.store.view.sort,
        this.store.view.filter,
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
