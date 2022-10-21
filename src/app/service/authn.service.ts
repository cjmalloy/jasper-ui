import { Injectable, Optional } from '@angular/core';
import { OAuthModuleConfig, OAuthService, OAuthStorage } from 'angular-oauth2-oidc';
import { filter, from, of } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthnService {

  constructor(
    private config: ConfigService,
    private oauth: OAuthService,
    private storage: OAuthStorage,
    @Optional() private moduleConfig: OAuthModuleConfig,
  ) { }

  get clientAuth() {
    return this.config.codeFlow || this.config.implicitFlow;
  }

  get init$() {
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
    return from(this.oauth.loadDiscoveryDocumentAndTryLogin());
  }

  logIn() {
    if (this.clientAuth) {
      this.oauth.initLoginFlow()
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
