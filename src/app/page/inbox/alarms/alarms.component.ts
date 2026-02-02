import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  viewChild
} from '@angular/core';
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
  selector: 'app-inbox-alarms',
  templateUrl: './alarms.component.html',
  styleUrls: ['./alarms.component.scss'],
  host: { 'class': 'alarms' },
  imports: [ RefListComponent]
})
export class InboxAlarmsPage implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

    mod.setTitle($localize`Inbox: Alarms`);
    store.view.clear(['modified']);
    query.clear();
  }

  ngOnInit(): void {
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
    }, { injector: this.injector });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
