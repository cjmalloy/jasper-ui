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
  selector: 'app-inbox-dms',
  templateUrl: './dms.component.html',
  styleUrls: ['./dms.component.scss'],
  host: { 'class': 'dms' },
  imports: [ RefListComponent]
})
export class InboxDmsPage implements OnDestroy, HasChanges {

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: DMs`);
    store.view.clear(['metadata->modified']);
    query.clear();

    effect(() => {
      const args = getArgs(
        (this.store.view.search ? 'dm:' : 'dm:!internal:') + `(${this.store.account.tagWithOrigin}|${this.store.account.inboxQuery})`,
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
