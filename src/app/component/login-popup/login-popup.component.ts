import { Component, inject } from '@angular/core';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-login-popup',
  templateUrl: './login-popup.component.html',
  styleUrls: ['./login-popup.component.scss'],
  host: { 'class': 'login-popup' },
  imports: [FakeLinkDirective]
})
export class LoginPopupComponent {
  store = inject(Store);
  config = inject(ConfigService);


  clear() {
    this.store.account.authError.set(false);
  }

  doLogin() {
    this.clear();
    window.open(this.config.loginLink, "_blank");
  }

}
