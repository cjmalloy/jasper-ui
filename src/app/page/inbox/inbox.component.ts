import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-inbox-page',
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.scss'],
  host: { 'class': 'inbox' },
  imports: [ TabsComponent, RouterLink, RouterLinkActive, SidebarComponent, RouterOutlet]
})
export class InboxPage {
  admin = inject(AdminService);
  store = inject(Store);
  private auth = inject(AuthzService);


  constructor() {
    if (!this.store.view.inboxTabs.length) {
      this.store.view.inboxTabs = this.admin.inbox.filter(p => this.auth.tagReadAccess(p.tag));
    }
  }
}

export const getInbox = () => {
  return inject(AdminService).inbox[0]?.tag || '';
};
