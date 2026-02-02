import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-inbox-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  imports: [ RefListComponent],
})
export class InboxRefPage implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  private admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  @ViewChild('list')
  list?: RefListComponent;

  plugin?: Plugin;
  writeAccess = false;

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

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
