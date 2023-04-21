import { Component, HostBinding, OnInit } from '@angular/core';
import { runInAction } from 'mobx';
import { AuthnService } from '../../service/authn.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-login-popup',
  templateUrl: './login-popup.component.html',
  styleUrls: ['./login-popup.component.scss']
})
export class LoginPopupComponent implements OnInit {
  @HostBinding('class') css = 'login-popup';

  constructor(
    public store: Store,
    public auth: AuthnService,
  ) { }

  ngOnInit(): void {
  }

  clear() {
    runInAction(() => this.store.account.authError = false);
  }

  doLogin() {
    this.clear();
    if (this.auth.clientAuth) {
      // TODO: fix refresh token
      this.auth.logIn();
    } else {
      window.open('/login', "_blank");
    }
  }

}
