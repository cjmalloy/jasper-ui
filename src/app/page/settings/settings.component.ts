import { Component, ChangeDetectionStrategy, afterNextRender } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  host: { 'class': 'settings' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsComponent,
    RouterLink,
    RouterLinkActive,
    SidebarComponent,
    RouterOutlet,
  ],
})
export class SettingsPage {

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    private auth: AuthzService,
    public store: Store,
  ) { }

  private readonly initialize = afterNextRender(() => {
    if (!this.store.view.settingsTabs().length) {
      {
        this.store.view.settingsTabs.set(this.admin.settings().filter(p => this.auth.tagReadAccess(p.tag)));
      };
    }
  });

}
