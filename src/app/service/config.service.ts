import { HttpClient } from '@angular/common/http';
import { Injectable, isDevMode } from '@angular/core';
import * as moment from 'moment';
import { tap } from 'rxjs/operators';
import { memo } from '../util/memo';

export function config(): ConfigService {
  // @ts-ignore
  return window.configService;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  version = moment().toISOString();
  title = 'Jasper';
  api = '//localhost:8081';
  electron = /electron/i.test(navigator.userAgent);
  logout = '';
  login = '';
  signup = '';
  scim = false;
  websockets = true;
  support = '+support';
  allowedSchemes = ['http:', 'https:', 'ftp:', 'tel:', 'mailto:', 'magnet:'];
  modSeals = ['seal', '+seal', 'seal', '_moderated'];
  editorSeals = ['qc'];

  maxPlugins = 1000;
  maxTemplates = 1000;
  maxExts = 1000;
  maxOrigins = 1000;
  fetchBatch = 50;

  // Debug token
  token = '';

  /**
   * Workaround for non-cookie based auth to scrape images before fetching.
   */
  preAuthScrape = isDevMode();

  mobileWidth = 740;

  constructor(
    private http: HttpClient,
  ) {
    // @ts-ignore
    window.configService = this;
  }

  @memo
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

  logIn() {
    if (this.login) {
      // @ts-ignore
      window.location = this.loginLink;
    }
  }
}
