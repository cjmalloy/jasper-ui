import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, viewChild, effect, inject, Injector } from '@angular/core';
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
  selector: 'app-inbox-modlist',
  templateUrl: './modlist.component.html',
  styleUrls: ['./modlist.component.scss'],
  host: { 'class': 'modlist' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RefListComponent]
})
export class InboxModlistPage implements OnInit, OnDestroy, HasChanges {

  private readonly injector = inject(Injector);

  readonly list = viewChild<RefListComponent>('list');

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    private router: Router,
  ) {
    mod.setTitle($localize`Inbox: Modlist`);
    store.view.clear(['modified']);
    query.clear();
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnInit(): void {
    if (!this.store.view.filter.length) {
      this.router.navigate([], { queryParams: { filter: ['query/!_moderated', 'query/public', 'query/!(_plugin:!+user)'] }, replaceUrl: true });
    }
    effect(() => {
      const args = getArgs(
        this.store.account.origin || '*',
        this.store.view.sort,
        this.store.view.filter,
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
