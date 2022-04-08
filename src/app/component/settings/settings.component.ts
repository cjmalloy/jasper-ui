import { Component, HostBinding, OnInit } from '@angular/core';
import { AccountService } from '../../service/account.service';
import { ConfigService } from '../../service/config.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';

  constructor(
    public config: ConfigService,
    public account: AccountService,
  ) {
    if (this.account.signedIn) {
      this.account.checkNotifications();
    }
  }

  ngOnInit(): void {
  }

}
