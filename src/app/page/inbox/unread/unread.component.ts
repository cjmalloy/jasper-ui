import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { RefPageArgs } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
  host: { 'class': 'unread' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MobxAngularModule, RefListComponent]
})
export class InboxUnreadPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private lastNotified = new Map<string, DateTime>();

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
        this.clearNotifications();
      }
      const args: RefPageArgs = {
        query: this.store.account.notificationsQuery,
        modifiedAfter: this.store.account.notificationCursor,
        sort: ['modified,ASC'],
        size: this.store.view.pageSize,
      };
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      if (this.query.page && this.query.page!.content.length) {
        for (const ref of this.query.page.content) {
          const origin = ref.origin || '';
          if (!ref.modified || this.lastNotified.get(origin) && ref.modified <= this.lastNotified.get(origin)!) continue;
          this.lastNotified.set(origin, ref.modified);
        }
      }
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.clearNotifications();
  }

  private clearNotifications() {
    for (const [origin, cursor] of this.lastNotified) {
      this.account.clearNotifications(cursor, [origin]);
    }
    this.lastNotified.clear();
  }
}
