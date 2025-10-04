import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, retry, throwError, timer } from 'rxjs';

@Injectable()
export class RateLimitInterceptor implements HttpInterceptor {

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          // Check if status code is 503 (Service Unavailable) or 429 (Too Many Requests)
          if (error.status === 503 || error.status === 429) {
            // Try to read X-RateLimit-Retry-After header
            const retryAfterHeader = error.headers?.get('X-RateLimit-Retry-After');
            
            if (retryAfterHeader) {
              // Parse the header value - it should be in seconds (can be decimal like 3.5)
              const retryAfterSeconds = parseFloat(retryAfterHeader);
              
              if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                console.warn(`Rate limit hit. Retrying after ${retryAfterSeconds} seconds`);
                // Convert seconds to milliseconds for timer
                return timer(retryAfterSeconds * 1000);
              }
            }
            
            // If no valid header, use exponential backoff (1s, 2s, 4s)
            const backoffDelay = Math.pow(2, retryCount - 1) * 1000;
            console.warn(`Rate limit hit. Retrying with exponential backoff: ${backoffDelay}ms`);
            return timer(backoffDelay);
          }
          
          // For other errors, don't retry
          throw error;
        },
      })
    );
  }
}
