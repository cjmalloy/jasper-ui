import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  version = 'debug';
  title = 'Jasper';
  api = '//localhost:8081';
  logout = '';
  login = '';
  signup = '';
  scim = false;

  // Enables client side auth
  codeFlow = false;
  implicitFlow = false;
  issuer = '';
  clientId = '';
  scope = 'openid email';

  constructor(
    private http: HttpClient,
  ) { }

  get base() {
    return document.getElementsByTagName('base')[0].href
  }

  get loginLink() {
    return this.login + '?rd=' + encodeURIComponent(''+window.location);
  }

  get load$() {
    return this.http.get(this.base + 'assets/config.json').pipe(
      tap((result: any) => {
        this.version = result['version'];
        this.title = result['title'];
        this.api = result['api'];
        this.logout = result['logout'];
        this.login = result['login'];
        this.signup = result['signup'];
        this.scim = result['scim'];
        this.codeFlow = result['codeFlow'];
        this.implicitFlow = result['implicitFlow'];
        this.issuer = result['issuer'];
        this.clientId = result['clientId'];
        this.scope = result['scope'];
      }),
    );
  }
}
