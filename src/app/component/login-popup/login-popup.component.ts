import { Component, HostBinding, OnInit } from '@angular/core';
import { LoginService } from '../../service/login.service';

@Component({
  selector: 'app-login-popup',
  templateUrl: './login-popup.component.html',
  styleUrls: ['./login-popup.component.scss']
})
export class LoginPopupComponent implements OnInit {
  @HostBinding('class') css = 'login-popup';

  authError = false;

  constructor(
    private login: LoginService,
  ) {
    login.authError$.subscribe(authError => this.authError = authError);
  }

  ngOnInit(): void {
  }

  doLogin() {
    this.authError = false;
    const loginWin = window.open('/login', "_blank");
    loginWin!.onbeforeunload = (event: BeforeUnloadEvent) => {
      this.login.loginCheck$.next(true);
    }
  }

}
