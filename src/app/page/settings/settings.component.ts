import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { isEqual } from 'lodash-es';
import { runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  host: { 'class': 'settings' },
  imports: [
    MobxAngularModule,
    TabsComponent,
    RouterLink,
    RouterLinkActive,
    SidebarComponent,
    RouterOutlet,
  ],
})
export class SettingsPage implements OnInit {

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
