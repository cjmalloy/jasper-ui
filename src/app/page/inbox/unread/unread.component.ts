import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/ref.service";
import { mergeMap } from "rxjs/operators";
import * as moment from "moment";
import { AccountService } from "../../../service/account.service";
import { ExtService } from "../../../service/ext.service";

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss']
})
export class UnreadComponent implements OnInit {

  page?: Page<Ref>;

  constructor(
    private account: AccountService,
    private refs: RefService,
    private exts: ExtService,
  ) {
    this.account.getMyUserExt().pipe(
      mergeMap(ext => this.refs.page({
        query: 'plugin/inbox/' + account.tag,
        modifiedAfter: ext.config.inbox.lastNotified || moment().subtract(1, 'year') }))
    ).subscribe(page => {
      this.page = page;
      if (!page.empty) {
        this.exts.patch(account.tag!, [{
          op: 'add',
          path: '/config/inbox/lastNotified',
          value: moment().toISOString(),
        }]).subscribe();
      }
    });
  }

  ngOnInit(): void {
  }

}
