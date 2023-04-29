import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';

export function config(): ConfigService {
  // @ts-ignore
  return window.configService;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  version = 'debug';
  title = 'Jasper';
  api = '//localhost:8081';
  electron = /electron/i.test(navigator.userAgent);
  logout = '';
  login = '';
  signup = '';
  scim = false;
  multiTenant = false;
  allowedSchemes = ['http:', 'https:', 'ftp:', 'tel:', 'mailto:', 'magnet:'];
  modSeals = ['seal', '+seal', 'seal', '_moderated'];
  editorSeals = ['qc'];

  maxPlugins = 1000;
  maxTemplates = 1000;
  maxOrigins = 1000;
  fetchBatch = 50;

  // Enables client side auth
  token = '';
  codeFlow = false;
  implicitFlow = false;
  issuer = 'https://dev--ih10zzw.us.auth0.com/';
  clientId = '8PRmqhzrFQLyBFxcZ1mN5kxb7KTL6jUY';
  scope = 'openid email';

  mobileWidth = 740;

  constructor(
    private http: HttpClient,
  ) {
    // @ts-ignore
    window.configService = this;
  }

  get base() {
    return document.getElementsByTagName('base')[0].href
  }

  get loginLink() {
    return this.login + '?rd=' + encodeURIComponent(''+window.location);
  }

  get load$() {
    return this.http.get(this.base + 'assets/config.json').pipe(
      tap((result: any) => {
        for (const k in this) {
          this[k] = result[k] || this[k];
        }
      }),
    );
  }

  get mobile() {
    return window.innerWidth <= this.mobileWidth;
  }
}
