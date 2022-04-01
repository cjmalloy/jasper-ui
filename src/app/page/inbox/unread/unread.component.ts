import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/ref.service";
import { mergeMap, tap } from "rxjs/operators";
import { UserService } from "../../../service/user.service";
import { TagService } from "../../../service/tag.service";
import * as moment from "moment";
import { Tag } from "../../../model/tag";

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss']
})
export class UnreadComponent implements OnInit {

  user?: string;
  tag?: Tag;
  page?: Page<Ref>;

  constructor(
    private users: UserService,
    private refs: RefService,
    private tags: TagService,
  ) {
    this.users.whoAmI().pipe(
      tap(user => this.user = user),
      mergeMap(user => this.tags.get(user)),
      tap(tag => this.tag = tag),
      mergeMap(tag => this.refs.page({
        query: 'plugin/inbox/' + this.user,
        modifiedAfter: tag?.config?.inbox?.lastNotified || moment().subtract(1, 'year') }))
    ).subscribe(page => {
      this.page = page;
      this.tag!.config ??= {};
      this.tag!.config.inbox ??= {};
      this.tag!.config.inbox.lastNotified = moment().toISOString();
      this.tags.update(this.tag!).subscribe();
    });
  }

  ngOnInit(): void {
  }

}
