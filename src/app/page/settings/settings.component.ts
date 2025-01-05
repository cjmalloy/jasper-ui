import { Component, HostBinding, OnInit } from '@angular/core';
import { runInAction } from 'mobx';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsPage implements OnInit {
  @HostBinding('class') css = 'settings';

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    private auth: AuthzService,
    public store: Store,
  ) { }

  ngOnInit(): void {
    if (!this.store.view.settingsTabs.length) {
      runInAction(() => {
        this.store.view.settingsTabs = this.admin.settings.filter(p => this.auth.tagReadAccess(p.tag));
      });
    }
  }

}
