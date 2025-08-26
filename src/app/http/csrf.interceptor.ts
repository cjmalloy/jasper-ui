import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, isDevMode } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { ConfigService } from '../service/config.service';

@Injectable()
export class CsrfInterceptor implements HttpInterceptor {

  withCredentials = isDevMode() || this.config.electron || location.hostname === 'localhost';

  constructor(
    private config: ConfigService,
  ) {}

  private getCsrfToken(): string {
    return document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')?.[1] || '';
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return next.handle(request);
    }

    const modifiedReq = request.clone({
      headers: request.headers.set('X-XSRF-TOKEN', this.getCsrfToken()),
      withCredentials: this.withCredentials,
    });
    return next.handle(modifiedReq).pipe(
      catchError(err => {
        if (!err.status || err.status === 403) {
          // Sometimes the first request has an invalid CSRF token and fails
          // Retry one more time
          console.warn('Retrying forbidden request with fresh CSRF token');
          const retryReq = request.clone({
            headers: request.headers.set('X-XSRF-TOKEN', this.getCsrfToken()),
            withCredentials: this.withCredentials,
          });
          return next.handle(retryReq);
        }
        return throwError(() => err);
      }),
    );
  }
}
