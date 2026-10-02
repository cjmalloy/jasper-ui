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
  selector: 'app-inbox-sent',
  templateUrl: './sent.component.html',
  styleUrls: ['./sent.component.scss'],
  host: { 'class': 'inbox-sent' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RefListComponent]
})
export class InboxSentPage implements OnInit, OnDestroy, HasChanges {

  private readonly injector = inject(Injector);

  readonly list = viewChild<RefListComponent>('list');

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: Sent`);
    store.view.clear();
    query.clear();
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnInit(): void {
    effect(() => {
      const args = getArgs(
        this.store.account.tag + ':(plugin/inbox|plugin/outbox)',
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
