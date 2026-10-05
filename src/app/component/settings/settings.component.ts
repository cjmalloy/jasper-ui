import { afterNextRender, Component, computed, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
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
  imports: [FakeLinkDirective, RouterLink]
})
export class SettingsComponent {
  admin = inject(AdminService);
  config = inject(ConfigService);
  store = inject(Store);
  account = inject(AccountService);
  private el = inject(ElementRef);
  private help = inject(HelpService);


  constructor() {
    const admin = this.admin;
    const store = this.store;
    const account = this.account;

    if (admin.getTemplate('user') && admin.getPlugin('plugin/inbox') && store.account.signedIn()) {
      account.checkNotifications();
    }
  }

  private readonly initializeView = afterNextRender(() => {
    this.help.pushStep(this.el?.nativeElement, $localize`Change your settings.`);
  });

  readonly fullUserTagAndRole = computed(() => {
    return this.store.account.tag() + ' (' + this.store.account.role() + ')';
  });

  readonly shortUserTag = computed(() => {
    return this.store.account.localTag().replace('+', '').replace('user/', '');
  });

}
