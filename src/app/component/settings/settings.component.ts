import { Component, HostBinding, OnInit } from "@angular/core";
import { UserService } from "../../service/user.service";
import { RefService } from "../../service/ref.service";
import { User } from "../../model/user";
import { ConfigService } from "../../service/config.service";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';

  user?: User;
  notifications = 0;

  constructor(
    public config: ConfigService,
    private users: UserService,
    private refs: RefService,
  ) {
    users.getMyUser()
      .subscribe(user => {
        this.user = user;
        this.refs.count({
          query: "plugin/inbox/" + user.tag,
          modifiedAfter: user.lastNotified,
        }).subscribe(count => this.notifications = count);
      });
  }

  ngOnInit(): void {
  }

}
