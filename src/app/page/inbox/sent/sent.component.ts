import { ChangeDetectionStrategy, Component, effect, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  standalone: false,
  selector: 'app-inbox-sent',
  templateUrl: './sent.component.html',
  styleUrls: ['./sent.component.scss'],
  host: {'class': 'inbox-sent'},
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxSentPage implements OnInit, OnDestroy, HasChanges {

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    mod.setTitle($localize`Inbox: Sent`);
    store.view.clear();
    query.clear();
    
    // Convert MobX autorun to Angular effect
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
    });
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.query.close();
  }
}
