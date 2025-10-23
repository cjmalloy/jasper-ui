import { Component } from '@angular/core';
import { runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-login-popup',
  templateUrl: './login-popup.component.html',
  styleUrls: ['./login-popup.component.scss'],
  host: { 'class': 'login-popup' },
  imports: [MobxAngularModule]
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
