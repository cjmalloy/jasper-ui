import { Component } from '@angular/core';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  host: {'class': 'settings'}
})
export class SettingsComponent {

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public store: Store,
    public account: AccountService,
  ) {
    if (admin.getTemplate('user') && admin.getPlugin('plugin/inbox') && store.account.signedIn) {
      account.checkNotifications();
    }
  }

  get fullUserTagAndRole() {
    return this.store.account.tag + ' (' + this.store.account.role + ')';
  }

  get shortUserTag() {
    return this.store.account.localTag.replace('+', '').replace('user/', '');
  }

}
