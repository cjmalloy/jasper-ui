import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { uniq } from 'lodash-es';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-inbox-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  imports: [RefListComponent],
})
export class InboxRefPage implements HasChanges {
  private mod = inject(ModService);
  private admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  readonly plugin = computed(() => this.admin.getPlugin(this.store.view.inboxTag()));

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Inbox: `);
    store.view.clear(['modified']);
    // Sync the document title
    effect(() => this.mod.setTitle($localize`Inbox: ${this.plugin()?.config?.inbox || this.store.view.inboxTag()}`));
    this.query.watch(() => getArgs(
      this.store.view.inboxTag() + (this.store.view.showRemotes() ? '' : (this.plugin()?.origin || '@')),
      this.store.view.sort(),
      uniq(['!obsolete', ...this.store.view.filter()]),
      this.store.view.search(),
      this.store.view.pageNumber(),
      this.store.view.pageSize(),
    ));
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }
}
