import { Injectable, isDevMode } from "@angular/core";
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable()
export class DebugInterceptor implements HttpInterceptor {

  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (isDevMode()) {
      request = request.clone({
        setHeaders: {
          // USER
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMiwiYXV0aCI6IlJPTEVfVVNFUiJ9.Ht6Zs8Oqjf-yzhoAK4A2xn2qKe38uCGLw56pkl8pQW4`
        }
      });
    }
    return next.handle(request);
  }
}
