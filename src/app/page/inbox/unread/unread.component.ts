import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, effect, inject, Injector, untracked } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RefListComponent]
})
export class InboxUnreadPage implements OnInit, OnDestroy {

  private readonly injector = inject(Injector);
  private lastNotified?: DateTime;

  constructor(
    private mod: ModService,
    public store: Store,
    public query: QueryStore,
    private account: AccountService,
    private router: Router,
  ) {
    mod.setTitle($localize`Inbox: Unread`);
    store.view.clear(['modified']);
    query.clear();
  }

  ngOnInit(): void {
    effect(() => {
      this.store.view.pageNumber;
      this.store.account.notificationsQuery;
      this.store.account.config.lastNotified;
      this.store.view.pageSize;
      untracked(() => {
        if (this.store.view.pageNumber) {
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
          query: this.store.account.notificationsQuery,
          modifiedAfter: this.store.account.config.lastNotified,
          sort: ['modified,ASC'],
          size: this.store.view.pageSize,
        };
        defer(() => this.query.setArgs(args));
      });
    }, { injector: this.injector });
    effect(() => {
      if (this.query.page && this.query.page!.content.length) {
        this.lastNotified = newest(this.query.page!.content)!.modified!;
      }
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.query.close();
    if (this.lastNotified) {
      this.account.clearNotifications(this.lastNotified);
    }
  }

}
