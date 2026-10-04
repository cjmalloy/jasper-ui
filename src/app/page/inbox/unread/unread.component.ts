import { Component, computed, DestroyRef, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { newest } from '../../../mods/mailbox';
import { AccountService } from '../../../service/account.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
  host: { 'class': 'unread' },
  imports: [RefListComponent]
})
export class InboxUnreadPage {
  private mod = inject(ModService);
  store = inject(Store);
  query = inject(QueryStore);
  private account = inject(AccountService);
  private router = inject(Router);


  private readonly lastNotified = computed(() => newest(this.query.page()?.content || [])?.modified);

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Inbox: Unread`);
    store.view.clear(['modified']);
    this.query.watch(() => ({
      query: this.store.account.notificationsQuery(),
      modifiedAfter: this.store.account.config().lastNotified,
      sort: ['modified,ASC'],
      size: this.store.view.pageSize(),
    }));
    // Sync paging to the server: the next page marks the current page as read
    effect(() => {
      if (!this.store.view.pageNumber()) return;
      untracked(() => {
        this.router.navigate([], {
          queryParams: { pageNumber: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
        const lastNotified = this.lastNotified();
        if (lastNotified) this.account.clearNotifications(lastNotified);
      });
    });
  }

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    const lastNotified = this.lastNotified();
    if (lastNotified) this.account.clearNotifications(lastNotified);
  });

}
