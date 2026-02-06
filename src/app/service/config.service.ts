import { HttpClient } from '@angular/common/http';
import { inject, Injectable, isDevMode } from '@angular/core';
import { DateTime } from 'luxon';
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
  private http = inject(HttpClient);

  version = DateTime.now().toISO();
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
  editorSeals = ['plugin/qc'];

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
  prefetch = isDevMode();

  miniWidth = 380;
  mobileWidth = 740;
  tabletWidth = 948;
  hugeWidth = 1500;

  constructor() {
    // @ts-ignore
    window.configService = this;
  }

  @memo
  get base() {
    return document.getElementsByTagName('base')[0].href;
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

  get mini() {
    return window.innerWidth <= this.miniWidth;
  }

  get mobile() {
    return window.innerWidth <= this.mobileWidth;
  }

  get tablet() {
    return window.innerWidth <= this.tabletWidth;
  }


  get huge() {
    return window.innerWidth >= this.hugeWidth;
  }

  logIn() {
    if (this.login) {
      // @ts-ignore
      window.location = this.loginLink;
    }
  }
}
