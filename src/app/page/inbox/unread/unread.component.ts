import { Component, effect, untracked, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { DateTime } from 'luxon';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { RefPageArgs } from '../../../model/ref';
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


  private lastNotified?: DateTime;

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

    mod.setTitle($localize`Inbox: Unread`);
    store.view.clear(['modified']);
    query.clear();
    effect(() => {
      this.store.view.pageNumber();
      this.store.account.notificationsQuery();
      this.store.account.config().lastNotified;
      this.store.view.pageSize();
      untracked(() => {
        if (this.store.view.pageNumber()) {
          this.router.navigate([], {
            queryParams: { pageNumber: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
          if (this.lastNotified) {
            this.account.clearNotifications(this.lastNotified);
          }
        }
        const args: RefPageArgs = {
          query: this.store.account.notificationsQuery(),
          modifiedAfter: this.store.account.config().lastNotified,
          sort: ['modified,ASC'],
          size: this.store.view.pageSize(),
        };
        defer(() => this.query.setArgs(args));
      });
    });
    effect(() => {
      if (this.query.page() && this.query.page()!.content.length) {
        this.lastNotified = newest(this.query.page()!.content)!.modified!;
      }
    });
  }

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.query.close();
    if (this.lastNotified) {
      this.account.clearNotifications(this.lastNotified);
    }
  });

}
