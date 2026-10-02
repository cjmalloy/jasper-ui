import { Component, inject, ChangeDetectionStrategy, afterNextRender } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-inbox-page',
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.scss'],
  host: { 'class': 'inbox' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabsComponent, RouterLink, RouterLinkActive, SidebarComponent, RouterOutlet]
})
export class InboxPage {

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
  ) { }

  private readonly initialize = afterNextRender(() => {
    if (!this.store.view.inboxTabs().length) {
      {
        this.store.view.inboxTabs.set(this.admin.inbox().filter(p => this.auth.tagReadAccess(p.tag)));
      };
    }
  });

}

export const getInbox = () => {
  return inject(AdminService).inbox()[0]?.tag || '';
};
