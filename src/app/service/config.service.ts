import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  api = '//localhost:8081';
  logout = '';
  login = '';
  signup = '';

  constructor(
    public http: HttpClient,
  ) { }

  load() {
    return this.http.get('/assets/config.json').pipe(
      tap((result: any) => {
        this.api = result['api'];
        this.logout = result['logout'];
        this.login = result['login'];
        this.signup = result['signup'];
      })
    );
  }
}
