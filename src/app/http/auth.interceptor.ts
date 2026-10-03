import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponseBase } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { from, Observable, switchMap, tap } from 'rxjs';
import { ConfigService } from '../service/config.service';
import { Store } from '../store/store';
import { base64Bytes, signJwt } from '../util/jwt';

/**
 * The jasper-app electron window sends the per-launch JWT secret in this
 * header. The client nginx echoes it back in the response.
 */
export const JASPER_KEY_HEADER = 'X-Jasper-Key';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private secret = '';
  private tokenSecret = '';
  private tokenUserTag = '';
  private minting?: Promise<string>;

  constructor(
    private config: ConfigService,
    private store: Store,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const minting = this.updateToken();
    if (minting) return from(minting).pipe(switchMap(() => this.handle(request, next)));
    return this.handle(request, next);
  }

  private handle(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const userTag = this.secret ? '' : this.store.local.selectedUserTag;
    if (!this.config.token && !userTag) return this.readSecret(next.handle(request));
    let headers = request.headers;
    if (this.config.token) {
      headers = headers.set('Authorization', 'Bearer ' + this.config.token);
    }
    if (userTag) {
      headers = headers.set('User-Tag', userTag);
    }
    return this.readSecret(next.handle(request.clone({ headers })));
  }

  private readSecret(events: Observable<HttpEvent<unknown>>) {
    return events.pipe(tap(event => {
      if (!(event instanceof HttpResponseBase)) return;
      const secret = event.headers.get(JASPER_KEY_HEADER);
      if (secret) this.secret = secret;
    }));
  }

  /**
   * Create a new token when the secret or user tag changes.
   */
  private updateToken() {
    if (!this.secret) return undefined;
    const secret = this.secret;
    const userTag = this.store.local.selectedUserTag;
    if (secret === this.tokenSecret && userTag === this.tokenUserTag) return this.minting;
    this.tokenSecret = secret;
    this.tokenUserTag = userTag;
    this.config.token = '';
    const minting = this.minting = this.getToken(secret, userTag).then(jwt => {
      if (this.minting === minting) {
        this.config.token = jwt;
        this.minting = undefined;
      }
      return jwt;
    }).catch(err => {
      console.error('Could not create token', err);
      if (this.minting === minting) {
        this.tokenSecret = '';
        this.minting = undefined;
      }
      return '';
    });
    return minting;
  }

  private getToken(secret: string, userTag: string) {
    const tag = userTag || '+user';
    const roles = tag === '+user' || tag === '_user' ? ['ROLE_ADMIN'] : ['ROLE_ANONYMOUS'];
    if (tag.startsWith('_')) roles.push('ROLE_PRIVATE');
    return signJwt({
      sub: tag,
      auth: roles.join(','),
    }, base64Bytes(secret));
  }
}
