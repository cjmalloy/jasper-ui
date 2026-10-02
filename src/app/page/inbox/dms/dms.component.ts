import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, viewChild, effect, inject, Injector } from '@angular/core';
import { defer } from 'lodash-es';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RefListComponent]
})
export class InboxDmsPage implements OnInit, OnDestroy, HasChanges {

  private readonly injector = inject(Injector);

  readonly list = viewChild<RefListComponent>('list');

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: DMs`);
    store.view.clear(['metadata->modified']);
    query.clear();
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnInit(): void {
    effect(() => {
      const args = getArgs(
        (this.store.view.search ? 'dm:' : 'dm:!internal:') + `(${this.store.account.tagWithOrigin}|${this.store.account.inboxQuery})`,
        this.store.view.sort,
        ['query/!plugin/delete', 'user/!plugin/user/hide', ...this.store.view.filter],
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.query.close();
  }
}
