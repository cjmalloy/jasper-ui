import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { RefPageArgs } from '../../../model/ref';
import { newest } from '../../../plugin/mailbox';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
})
export class InboxUnreadPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    public store: Store,
    public query: QueryStore,
    private refs: RefService,
    private account: AccountService,
  ) {
    theme.setTitle('Inbox: Unread');
    store.view.clear();
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args: RefPageArgs = {
        query: this.store.account.notificationsQuery,
        modifiedAfter: this.store.account.config.lastNotified,
        sort: ['modified,ASC'],
      };
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      if (this.query.page && !this.query.page!.empty) {
        this.account.clearNotifications(newest(this.query.page!.content)!.modified!);
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
