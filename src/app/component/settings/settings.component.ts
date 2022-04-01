import { Component, HostBinding, OnInit } from "@angular/core";
import { UserService } from "../../service/user.service";
import { RefService } from "../../service/ref.service";
import { ConfigService } from "../../service/config.service";
import { mergeMap, tap } from "rxjs/operators";
import { ExtService } from "../../service/ext.service";
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
    private exts: ExtService,
  ) {
    users.whoAmI().pipe(
      tap(user => this.user = user),
      mergeMap(user => exts.get(user)),
      mergeMap(ext => this.refs.count({
        query: "plugin/inbox/" + this.user,
        modifiedAfter: ext.config?.inbox?.lastNotified || moment().subtract(1, 'year') }))
    ).subscribe(count => this.notifications = count);
  }

  ngOnInit(): void {
  }

}
