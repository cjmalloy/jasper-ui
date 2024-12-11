import { Component, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
  selector: 'app-inbox-dms',
  templateUrl: './dms.component.html',
  styleUrls: ['./dms.component.scss']
})
export class InboxDmsPage implements OnInit, OnDestroy, HasChanges {
  @HostBinding('class') css = 'dms';

  private disposers: IReactionDisposer[] = [];

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: DMs`);
    store.view.clear(['metadataModified']);
    query.clear();
  }

  saveChanges() {
    return !!this.list?.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        `dm:!plugin/thread:(${this.store.account.tag}|${this.store.account.inboxQuery})`,
        this.store.view.sort,
        this.store.view.filter.includes('query/plugin/delete') ? [...this.store.view.filter] : ['query/!plugin/delete', ...this.store.view.filter],
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
