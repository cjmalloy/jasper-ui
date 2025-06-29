import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MobxAngularModule } from 'mobx-angular';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ConfigService } from '../../service/config.service';
import { HelpService } from '../../service/help.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  host: { 'class': 'settings' },
  imports: [MobxAngularModule, RouterLink]
})
export class SettingsComponent implements AfterViewInit {

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public store: Store,
    public account: AccountService,
    private el: ElementRef,
    private help: HelpService,
  ) {
    if (admin.getTemplate('user') && admin.getPlugin('plugin/inbox') && store.account.signedIn) {
      account.checkNotifications();
    }
  }

  ngAfterViewInit() {
    this.help.pushStep(this.el, $localize`Change your settings.`);
  }

  get fullUserTagAndRole() {
    return this.store.account.tag + ' (' + this.store.account.role + ')';
  }

  get shortUserTag() {
    return this.store.account.localTag.replace('+', '').replace('user/', '');
  }

}
