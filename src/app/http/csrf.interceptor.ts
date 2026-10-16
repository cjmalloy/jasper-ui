import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConfigService } from '../service/config.service';

function getCsrfToken(): string {
  return document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')?.[1] || '';
}

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return next(request);
  }
  const withCredentials = environment.dev || inject(ConfigService).electron || location.hostname === 'localhost';
  const withToken = (token: string) => request.clone({
    headers: request.headers.set('X-XSRF-TOKEN', token),
    withCredentials,
  });
  const token = getCsrfToken();
  return next(withToken(token)).pipe(
    catchError(err => {
      // Concurrent startup requests can each set a new XSRF-TOKEN cookie, so the
      // cookie may change after the header was read. The 403 body is not always
      // readable (e.g. large uploads), so also retry if the cookie changed.
      const csrf = token !== getCsrfToken() || /CSRF token/i.test(err.error?.detail || '');
      if (!err.status || err.status === 403 && csrf) {
        console.warn('Retrying forbidden request with fresh CSRF token');
        return next(withToken(getCsrfToken()));
      }
      return throwError(() => err);
    }),
  );
};
