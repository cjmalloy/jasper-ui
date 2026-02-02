import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login-popup',
  templateUrl: './login-popup.component.html',
  styleUrls: ['./login-popup.component.scss'],
  host: { 'class': 'login-popup' },
  imports: []
})
export class LoginPopupComponent {
  store = inject(Store);
  config = inject(ConfigService);


  clear() {
    this.store.account.authError = false;
  }

  doLogin() {
    this.clear();
    window.open(this.config.loginLink, "_blank");
  }

}
