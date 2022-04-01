import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/ref.service";
import { mergeMap, tap } from "rxjs/operators";
import { UserService } from "../../../service/user.service";
import { ExtService } from "../../../service/ext.service";
import * as moment from "moment";
import { Ext } from "../../../model/ext";

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss']
})
export class UnreadComponent implements OnInit {

  user?: string;
  ext?: Ext;
  page?: Page<Ref>;

  constructor(
    private users: UserService,
    private refs: RefService,
    private exts: ExtService,
  ) {
    this.users.whoAmI().pipe(
      tap(user => this.user = user),
      mergeMap(user => this.exts.get(user)),
      tap(ext => this.ext = ext),
      mergeMap(tag => this.refs.page({
        query: 'plugin/inbox/' + this.user,
        modifiedAfter: tag?.config?.inbox?.lastNotified || moment().subtract(1, 'year') }))
    ).subscribe(page => {
      this.page = page;
      this.ext!.config ??= {};
      this.ext!.config.inbox ??= {};
      this.ext!.config.inbox.lastNotified = moment().toISOString();
      this.exts.update(this.ext!).subscribe();
    });
  }

  ngOnInit(): void {
  }

}
