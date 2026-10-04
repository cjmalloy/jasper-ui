import { Component, viewChild, effect, inject, Injector, afterNextRender, DestroyRef } from '@angular/core';
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
  selector: 'app-inbox-reports',
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  host: { 'class': 'modlist' },
  imports: [
    RefListComponent,
  ],
})
export class InboxReportsPage  implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);
  private router = inject(Router);


  private readonly injector = inject(Injector);

  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

    mod.setTitle($localize`Inbox: Reports`);
    store.view.clear(['modified']);
    query.clear();
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  private readonly initialize = afterNextRender(() => {
    if (!this.store.view.filter().length) {
      this.router.navigate([], { queryParams: { filter: ['plugin/user/report', '!+plugin/user/approve'] }, replaceUrl: true });
    }
    effect(() => {
      const args = getArgs(
        '@*',
        this.store.view.sort(),
        this.store.view.filter(),
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      );
      defer(() => this.query.setArgs(args));
    }, { injector: this.injector });
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.query.close();
  });
}
