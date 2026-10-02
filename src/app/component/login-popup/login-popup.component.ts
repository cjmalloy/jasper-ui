import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-login-popup',
  templateUrl: './login-popup.component.html',
  styleUrls: ['./login-popup.component.scss'],
  host: { 'class': 'login-popup' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective]
})
export class LoginPopupComponent {

  constructor(
    public store: Store,
    public config: ConfigService,
  ) { }

  clear() {
    this.store.account.authError = false;
  }

  doLogin() {
    this.clear();
    window.open(this.config.loginLink, "_blank");
  }

}
