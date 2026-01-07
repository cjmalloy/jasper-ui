import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
  imports: [MobxAngularModule, RefListComponent]
})
export class InboxUnreadPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
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
    this.disposers.push(autorun(() => {
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
    }));
    this.disposers.push(autorun(() => {
      if (this.query.page && this.query.page!.content.length) {
        this.lastNotified = newest(this.query.page!.content)!.modified!;
      }
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    if (this.lastNotified) {
      this.account.clearNotifications(this.lastNotified);
    }
  }

}
