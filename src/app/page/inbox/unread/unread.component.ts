import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/ref.service";
import { mergeMap, tap } from "rxjs/operators";
import { UserService } from "../../../service/user.service";
import { User } from "../../../model/user";

@Component({
  selector: 'app-unread',
  templateUrl: './unread.component.html',
  styleUrls: ['./unread.component.scss']
})
export class UnreadComponent implements OnInit {

  user?: User;
  page?: Page<Ref>;

  constructor(
    private users: UserService,
    private refs: RefService,
  ) {
    users.getMyUser().pipe(
      tap(user => this.user = user),
      mergeMap(user => refs.page({ query: 'plugin/inbox/' + user.tag, modifiedAfter: user.lastNotified })))
    .subscribe(page => {
      this.page = page;
      users.clearNotifications(this.user!.tag).subscribe();
    });
  }

  ngOnInit(): void {
  }

}
