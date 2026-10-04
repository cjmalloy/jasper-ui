import { Component, viewChild, inject, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-inbox-modlist',
  templateUrl: './modlist.component.html',
  styleUrls: ['./modlist.component.scss'],
  host: { 'class': 'modlist' },
  imports: [RefListComponent]
})
export class InboxModlistPage implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);
  private router = inject(Router);



  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Inbox: Modlist`);
    store.view.clear(['modified']);
    this.query.watch(() => getArgs(
      this.store.account.origin() || '*',
      this.store.view.sort(),
      this.store.view.filter(),
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
      this.router.navigate([], { queryParams: { filter: ['query/!_moderated', 'query/public', 'query/!(_plugin:!+user)'] }, replaceUrl: true });
    }
  });
}
