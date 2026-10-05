import { afterNextRender, Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-inbox-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss'],
  host: { 'class': 'inbox-all' },
  imports: [RefListComponent]
})
export class InboxAllPage implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);
  private router = inject(Router);



  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Inbox: All`);
    store.view.clear(['modified']);
    this.query.watch(() => getArgs(
      this.store.account.inboxQuery(),
      this.store.view.sort(),
      ['query/!plugin/delete', 'user/!plugin/user/hide', ...this.store.view.filter()],
      this.store.view.search(),
      this.store.view.pageNumber(),
      this.store.view.pageSize(),
    ));
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  private readonly initialize = afterNextRender(() => {
    if (!this.store.view.filter().length) {
      this.router.navigate([], { queryParams: { filter: ['query/!(dm)'] }, replaceUrl: true });
    }
  });
}
