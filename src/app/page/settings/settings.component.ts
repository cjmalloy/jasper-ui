import { Component, HostBinding, OnInit } from '@angular/core';
import { runInAction } from 'mobx';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
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
  ) {
    runInAction(() => {
      store.settings.plugins = admin.settings.filter(p => auth.tagReadAccess(p.tag));
    });
  }

  ngOnInit(): void {
  }

}
