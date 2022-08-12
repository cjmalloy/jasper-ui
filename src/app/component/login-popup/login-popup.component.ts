import { Component, HostBinding, OnInit } from '@angular/core';
import { runInAction } from 'mobx';
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
  ) { }

  ngOnInit(): void {
  }

  clear() {
    runInAction(() => this.store.account.authError = false);
  }

  doLogin() {
    this.clear();
    window.open('/login', "_blank");
  }

}
