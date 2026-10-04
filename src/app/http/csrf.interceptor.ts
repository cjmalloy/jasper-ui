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
  const withToken = () => request.clone({
    headers: request.headers.set('X-XSRF-TOKEN', getCsrfToken()),
    withCredentials,
  });
  return next(withToken()).pipe(
    catchError(err => {
      if (!err.status || err.status === 403 && err.error?.detail?.startsWith('Invalid CSRF Token')) {
        // Sometimes the first request has an invalid CSRF token and fails
        // Retry one more time
        console.warn('Retrying forbidden request with fresh CSRF token');
        return next(withToken());
      }
      return throwError(() => err);
    }),
  );
};
