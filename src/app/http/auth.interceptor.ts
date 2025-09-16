import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../service/config.service';
import { UserTagService } from '../service/user-tag.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private config: ConfigService,
    private userTagService: UserTagService,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let headers = request.headers;
    
    // Add Authorization header if token is available
    if (this.config.token) {
      headers = headers.set('Authorization', 'Bearer ' + this.config.token);
    }
    
    // Add User-Tag header if we have a selected user tag and this is a request to the API
    const userTag = this.userTagService.currentUserTag;
    if (userTag && request.url.includes('/api/')) {
      headers = headers.set('User-Tag', userTag);
    }
    
    return next.handle(request.clone({ headers }));
  }
}
