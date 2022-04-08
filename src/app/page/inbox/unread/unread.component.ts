import { Component, OnInit } from '@angular/core';
import * as moment from 'moment';
import { Observable } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss'],
})
export class UnreadComponent implements OnInit {

  page$: Observable<Page<Ref>>;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) {
    this.page$ = this.account.userExt$.pipe(
      mergeMap(ext => this.refs.page({
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
