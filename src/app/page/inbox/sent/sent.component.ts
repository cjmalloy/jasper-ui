import { Component, viewChild, effect, DestroyRef, inject } from '@angular/core';
import { defer } from 'lodash-es';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-inbox-sent',
  templateUrl: './sent.component.html',
  styleUrls: ['./sent.component.scss'],
  host: { 'class': 'inbox-sent' },
  imports: [RefListComponent]
})
export class InboxSentPage implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

    mod.setTitle($localize`Inbox: Sent`);
    store.view.clear();
    query.clear();
    effect(() => {
      const args = getArgs(
        this.store.account.tag() + ':(plugin/inbox|plugin/outbox)',
        this.store.view.sort(),
        ['query/!plugin/delete', 'user/!plugin/user/hide', ...this.store.view.filter()],
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      );
      defer(() => this.query.setArgs(args));
    });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.query.close();
  });
}
