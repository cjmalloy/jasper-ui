import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/api/ref.service";
import { mergeMap, tap } from "rxjs/operators";
import * as moment from "moment";
import { AccountService } from "../../../service/account.service";
import { Observable } from "rxjs";

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss']
})
export class UnreadComponent implements OnInit {

  page$: Observable<Page<Ref>>;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) {
    this.page$ = this.account.getMyUserExt().pipe(
      mergeMap(ext => this.refs.page({
        query: account.inbox,
        modifiedAfter: ext.config.inbox.lastNotified || moment().subtract(1, 'year')
      })),
      tap(page => {
        if (!page.empty) this.account.clearNotifications();
      }),
    );
  }

  ngOnInit(): void {
  }

}
