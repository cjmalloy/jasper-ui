import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class CsrfInterceptor implements HttpInterceptor {

  private getCsrfToken(): string {
    return document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')?.[1] || '';
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return next.handle(request);
    }

    const modifiedReq = request.clone({
      headers: request.headers.set('X-CSRF-TOKEN', this.getCsrfToken()),
      withCredentials: true,
    });
    return next.handle(modifiedReq);
  }
}
