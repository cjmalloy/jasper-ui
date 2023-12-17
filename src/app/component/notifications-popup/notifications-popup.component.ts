import { AfterViewInit, Component, HostBinding } from '@angular/core';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-notifications-popup',
  templateUrl: './notifications-popup.component.html',
  styleUrl: './notifications-popup.component.scss'
})
export class NotificationsPopupComponent implements AfterViewInit {
  @HostBinding('class') css = 'notifications-popup';

  notifications?: PermissionStatus;

  constructor(
    private store: Store,
    private admin: AdminService,
  ) { }

  ngAfterViewInit() {
    if (this.admin.getTemplate('user') &&
      this.store.account.userTag &&
      !this.store.local.disableNotifications) {
      this.check();
    }
  }

  check() {
    navigator.permissions.query({
      name: "notifications",
    }).then(notifications => this.notifications = notifications);
  }

  prompt() {
    Notification.requestPermission()
      .then(() => this.check());
  }

  clear() {
    delete this.notifications;
    this.store.local.disableNotifications = true;
  }

}
