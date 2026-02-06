import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  host: { 'class': 'settings' },
  imports: [
    TabsComponent,
    RouterLink,
    RouterLinkActive,
    SidebarComponent,
    RouterOutlet,
  ],
})
export class SettingsPage {
  admin = inject(AdminService);
  config = inject(ConfigService);
  private auth = inject(AuthzService);
  store = inject(Store);


  constructor() {
    if (!this.store.view.settingsTabs.length) {
      this.store.view.settingsTabs = this.admin.settings.filter(p => this.auth.tagReadAccess(p.tag));
    }
  }
}
