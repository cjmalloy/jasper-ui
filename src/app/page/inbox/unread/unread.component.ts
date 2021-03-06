import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as moment from 'moment';
import { Observable, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
})
export class InboxUnreadPage implements OnInit {

  page$: Observable<Page<Ref>>;

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    theme.setTitle('Inbox: Unread');
    this.page$ = this.account.userExt$.pipe(
      switchMap(ext => this.refs.page({
        query: account.inbox,
        modifiedAfter: ext.config.inbox.lastNotified || moment().subtract(1, 'year'),
      })),
      tap(page => {
        if (!page.empty) this.account.clearNotifications();
      }),
    );
  }

  ngOnInit(): void {
  }

}
