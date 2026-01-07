import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../service/config.service';
import { Store } from '../store/store';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private config: ConfigService,
    private store: Store,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const userTag = this.store.local.selectedUserTag;
    if (!this.config.token && !userTag) return next.handle(request);
    let headers = request.headers;
    if (this.config.token) {
      headers = headers.set('Authorization', 'Bearer ' + this.config.token);
    }
    if (userTag) {
      headers = headers.set('User-Tag', userTag);
    }
    return next.handle(request.clone({ headers }));
  }
}
