import { ChangeDetectionStrategy, Component, effect, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { defer } from 'lodash-es';
import { DateTime } from 'luxon';
import { RefPageArgs } from '../../../model/ref';
import { newest } from '../../../mods/mailbox';
import { AccountService } from '../../../service/account.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  standalone: false,
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
  host: {'class': 'unread'},
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxUnreadPage implements OnInit, OnDestroy {

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
    
    // Convert MobX autoruns to Angular effects
    effect(() => {
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
    
    effect(() => {
      if (this.query.page && this.query.page!.content.length) {
        this.lastNotified = newest(this.query.page!.content)!.modified!;
      }
    });
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.query.close();
    if (this.lastNotified) {
      this.account.clearNotifications(this.lastNotified);
    }
  }

}
