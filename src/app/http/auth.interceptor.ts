import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../service/config.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private config: ConfigService,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.config.token) return next.handle(request);
    const headers = request.headers.set('Authorization', 'Bearer ' + this.config.token);
    return next.handle(request.clone({ headers }));
  }
}
