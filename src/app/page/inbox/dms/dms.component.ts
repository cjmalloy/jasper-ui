import { Component, viewChild, inject } from '@angular/core';
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
  imports: [RefListComponent]
})
export class InboxDmsPage implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Inbox: DMs`);
    store.view.clear(['metadata->modified']);
    this.query.watch(() => getArgs(
      (this.store.view.search() ? 'dm:' : 'dm:!internal:') + `(${this.store.account.tagWithOrigin()}|${this.store.account.inboxQuery()})`,
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
}
