import { Component, HostBinding, OnInit } from '@angular/core';
import { runInAction } from 'mobx';
import { ConfigService } from '../../service/config.service';
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
    public config: ConfigService,
  ) { }

  ngOnInit(): void {
  }

  clear() {
    runInAction(() => this.store.account.authError = false);
  }

  doLogin() {
    this.clear();
    window.open(this.config.loginLink, "_blank");
  }

}
