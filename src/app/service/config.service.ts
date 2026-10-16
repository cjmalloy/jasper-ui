import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DateTime } from 'luxon';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export function config(): ConfigService {
  // @ts-ignore
  return window.configService;
}

function mediaSignal(query: string) {
  const result = signal(false);
  if (typeof window === 'undefined' || !window.matchMedia) return result;
  const media = window.matchMedia(query);
  result.set(media.matches);
  media.addEventListener?.('change', event => result.set(event.matches));
  return result;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private http = inject(HttpClient);
  private router = inject(Router);

  version = DateTime.now().toISO();
  title = 'Jasper';
  api = '//localhost:8081';
  electron = /electron/i.test(navigator.userAgent);
  logout = '';
  login = '';
  signup = '';
  pwa = false;
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
  maxEmbedNesting = 3;
  fetchBatch = 50;

  // Debug token
  token = '';

  /**
   * Workaround for non-cookie based auth to scrape images before fetching.
   */
  prefetch = environment.dev;

  readonly mini = mediaSignal('(max-width: 380px)');
  readonly mobile = mediaSignal('(max-width: 740px)');
  readonly tablet = mediaSignal('(max-width: 948px)');
  readonly huge = mediaSignal('(min-width: 1500px)');

  constructor() {
    // @ts-ignore
    window.configService = this;
  }

  private _base?: string;
  get base() {
    return this._base ??= document.getElementsByTagName('base')[0].href;
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

  logIn() {
    if (this.login) {
      // @ts-ignore
      window.location = this.loginLink;
    }
  }

  ref(url: string) {
    if (this.electron) {
      this.router.navigate(['/ref', url]);
    } else {
      window.open(this.base + 'ref/' + url);
    }
  }

  tag(tag: string) {
    if (this.electron) {
      this.router.navigate(['/tag', tag]);
    } else {
      window.open(this.base + 'tag/' + tag);
    }
  }
}
