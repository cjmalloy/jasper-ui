import { Injectable, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthModuleConfig, OAuthService, OAuthStorage } from 'angular-oauth2-oidc';
import { filter, from, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthnService {

  constructor(
    private config: ConfigService,
    private oauth: OAuthService,
    private storage: OAuthStorage,
    private router: Router,
    @Optional() private moduleConfig: OAuthModuleConfig,
  ) { }

  get clientAuth() {
    return this.config.codeFlow || this.config.implicitFlow;
  }

  set token(token: string) {
    this.storage.setItem('access_token', token);
    this.moduleConfig.resourceServer.sendAccessToken = true;
  }

  get init$() {
    if (this.config.token) {
      this.token = this.config.token;
      return of(null);
    }
    if (!this.clientAuth) return of(null);
    this.moduleConfig.resourceServer.sendAccessToken = true;
    this.moduleConfig.resourceServer.allowedUrls = [this.config.api];
    this.oauth.configure({
      issuer: this.config.issuer,
      strictDiscoveryDocumentValidation: false,
      redirectUri: this.config.base,
      clientId: this.config.clientId,
      responseType: this.config.codeFlow ? 'code' : 'id_token',
      scope: this.config.scope,
      preserveRequestedRoute: true,
      clearHashAfterLogin: true,
      requestAccessToken: !this.config.implicitFlow,
    });
    this.oauth.events.pipe(filter(e => e.type === 'logout')).subscribe(() => location.reload());
    if (this.config.implicitFlow) {
      this.oauth.events.pipe(filter(e => e.type === 'token_received')).subscribe(() => {
        this.storage.setItem('access_token', this.storage.getItem('id_token')!);
      });
    }
    return from(this.oauth.loadDiscoveryDocumentAndTryLogin()).pipe(
      tap(() => {
        if (this.oauth.state) {
          this.router.navigateByUrl(decodeURIComponent(this.oauth.state));
        }
      }));
  }

  logIn() {
    if (this.clientAuth) {
      this.oauth.initLoginFlow(this.router.url);
    } else if (this.config.login) {
      // @ts-ignore
      window.location = this.config.loginLink;
    }
  }

  logOut() {
    if (this.config.implicitFlow) {
      this.oauth.logOut();
    } else if (this.config.codeFlow) {
      this.oauth.revokeTokenAndLogout();
    }
  }
}
