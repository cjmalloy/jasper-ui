import { HttpClient } from '@angular/common/http';
import { Injectable, Optional } from '@angular/core';
import { OAuthModuleConfig, OAuthService, OAuthStorage } from 'angular-oauth2-oidc';
import { filter, from, of, take } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

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
    private oauth: OAuthService,
    private storage: OAuthStorage,
    @Optional() private moduleConfig: OAuthModuleConfig,
  ) { }

  get base() {
    return document.getElementsByTagName('base')[0].href
  }

  get clientAuth() {
    return this.codeFlow || this.implicitFlow;
  }

  get loginLink() {
    return this.login + '?rd=' + encodeURIComponent(''+window.location);
  }

  logOut() {
    if (this.implicitFlow) {
      this.oauth.logOut();
    } else {
      this.oauth.revokeTokenAndLogout();
    }
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
      switchMap(() => {
        if (!this.clientAuth) return of(null);
        this.moduleConfig.resourceServer.sendAccessToken = true;
        this.moduleConfig.resourceServer.allowedUrls = [this.api];
        this.oauth.configure({
          issuer: this.issuer,
          strictDiscoveryDocumentValidation: false,
          redirectUri: this.base,
          clientId: this.clientId,
          responseType: this.codeFlow ? 'code' : 'id_token',
          scope: this.scope,
          preserveRequestedRoute: true,
          clearHashAfterLogin: true,
          requestAccessToken: !this.implicitFlow,
        });
        this.oauth.events.pipe(filter(e => e.type === 'logout')).subscribe(() => location.reload());
        if (this.implicitFlow) {
          this.oauth.events.pipe(filter(e => e.type === 'token_received')).subscribe(() => {
              this.storage.setItem('access_token', this.storage.getItem('id_token')!);
          });
        }
        return from(this.oauth.loadDiscoveryDocumentAndTryLogin());
      }),
    );
  }
}
