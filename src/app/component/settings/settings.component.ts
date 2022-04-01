import { Component, HostBinding, OnInit } from "@angular/core";
import { UserService } from "../../service/user.service";
import { RefService } from "../../service/ref.service";
import { ConfigService } from "../../service/config.service";
import { mergeMap, tap } from "rxjs/operators";
import { TagService } from "../../service/tag.service";
import * as moment from "moment";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';

  user?: string;
  notifications = 0;

  constructor(
    public config: ConfigService,
    private users: UserService,
    private refs: RefService,
    private tags: TagService,
  ) {
    users.whoAmI().pipe(
      tap(user => this.user = user),
      mergeMap(user => tags.get(user)),
      mergeMap(tag => this.refs.count({
        query: "plugin/inbox/" + this.user,
        modifiedAfter: tag.config?.inbox?.lastNotified || moment().subtract(1, 'year') }))
    ).subscribe(count => this.notifications = count);
  }

  ngOnInit(): void {
  }

}
