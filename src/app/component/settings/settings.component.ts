import { Component, HostBinding, OnInit } from "@angular/core";
import { ConfigService } from "../../service/config.service";
import { AccountService } from "../../service/account.service";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';

  notifications = 0;

  constructor(
    public config: ConfigService,
    public account: AccountService,
  ) {
    this.account.notifications.subscribe(count => this.notifications = count);
  }

  ngOnInit(): void {
    this.account.checkNotifications();
  }

}
