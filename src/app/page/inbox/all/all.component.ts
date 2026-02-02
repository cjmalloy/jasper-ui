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
import { Router } from '@angular/router';
import { defer } from 'lodash-es';

import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-inbox-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss'],
  host: { 'class': 'inbox-all' },
  imports: [ RefListComponent]
})
export class InboxAllPage implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);
  private router = inject(Router);


  @ViewChild('list')
  list?: RefListComponent;

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

    mod.setTitle($localize`Inbox: All`);
    store.view.clear(['modified']);
    query.clear();

    if (!this.store.view.filter.length) {
      this.router.navigate([], { queryParams: { filter: ['query/!(dm)'] }, replaceUrl: true });
    }
  }

  ngOnInit(): void {
    effect(() => {
      const args = getArgs(
        this.store.account.inboxQuery,
        this.store.view.sort,
        ['query/!plugin/delete', 'user/!plugin/user/hide', ...this.store.view.filter],
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
