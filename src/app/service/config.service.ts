import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  api = '//localhost:8081';
  logout = '';
  login = '';
  signup = '';

  constructor(
    public http: HttpClient,
  ) { }

  get base() {
    return document.getElementsByTagName('base')[0].href
  }

  get load$() {
    return this.http.get(this.base + 'assets/config.json').pipe(
      tap((result: any) => {
        this.api = result['api'];
        this.logout = result['logout'];
        this.login = result['login'];
        this.signup = result['signup'];
      }),
    );
  }
}
