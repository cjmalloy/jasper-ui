import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
    imports: [MobxAngularModule, TabsComponent, RouterLink, RouterLinkActive, SidebarComponent, RouterOutlet]
})
export class InboxPage implements OnInit {

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
  ) { }

  ngOnInit(): void {
    if (!this.store.view.inboxTabs.length) {
      runInAction(() => {
        this.store.view.inboxTabs = this.admin.inbox.filter(p => this.auth.tagReadAccess(p.tag));
      });
    }
  }

}

export const getInbox = () => {
  return inject(AdminService).inbox[0]?.tag || '';
};
