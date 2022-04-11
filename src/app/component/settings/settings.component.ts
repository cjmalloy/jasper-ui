import { Component, HostBinding, OnInit } from '@angular/core';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ConfigService } from '../../service/config.service';
import { formatTag } from '../../util/format';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';
  formatTag = formatTag;

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public account: AccountService,
  ) {
    if (admin.status.plugins.inbox && account.signedIn) {
      account.checkNotifications();
    }
  }

  ngOnInit(): void {
  }

}
