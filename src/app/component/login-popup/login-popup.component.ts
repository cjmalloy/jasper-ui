import { Component } from '@angular/core';
import { runInAction } from 'mobx';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-login-popup',
  templateUrl: './login-popup.component.html',
  styleUrls: ['./login-popup.component.scss'],
  host: {'class': 'login-popup'}
})
export class LoginPopupComponent {

  constructor(
    public store: Store,
    public config: ConfigService,
  ) { }

  clear() {
    runInAction(() => this.store.account.authError = false);
  }

  doLogin() {
    this.clear();
    window.open(this.config.loginLink, "_blank");
  }

}
