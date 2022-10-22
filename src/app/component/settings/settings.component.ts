import { Component, HostBinding, OnInit } from '@angular/core';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { AuthnService } from '../../service/authn.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public authn: AuthnService,
    public store: Store,
    private account: AccountService,
  ) {
    if (admin.status.templates.user && admin.status.plugins.inbox && store.account.signedIn) {
      account.checkNotifications();
    }
  }

  ngOnInit(): void {
  }

  get fullUserTagAndRole() {
    return this.store.account.tag + ' (' + this.store.account.role + ')';
  }

  get shortUserTag() {
    return this.store.account.localTag.replace('+', '').replace('user/', '');
  }

}
