import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, retry, timer } from 'rxjs';

@Injectable()
export class RateLimitInterceptor implements HttpInterceptor {
  private readonly retryableStatuses = new Set([408, 429, 503, 504]);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          if (this.retryableStatuses.has(error.status)) {
            const retryAfterHeader = error.headers?.get('X-RateLimit-Retry-After')
              ?? error.headers?.get('Retry-After');

            if (retryAfterHeader) {
              const retryAfterSeconds = parseFloat(retryAfterHeader);

              if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                console.warn(`Retryable request failure (${error.status}). Retrying after ${retryAfterSeconds} seconds`);
                return timer(retryAfterSeconds * 1000);
              }
            }

            const backoffDelay = Math.pow(2, retryCount - 1) * 1000;
            console.warn(`Retryable request failure (${error.status}). Retrying with exponential backoff: ${backoffDelay}ms`);
            return timer(backoffDelay);
          }

          throw error;
        },
      })
    );
  }
}
