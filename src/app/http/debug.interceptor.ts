import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, isDevMode } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class DebugInterceptor implements HttpInterceptor {

  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (isDevMode()) {
      request = request.clone({
        setHeaders: {
          // VIEWER
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX1ZJRVdFUiJ9.CeRNekpAdrZyuriIRF8-GqwEvv1scCgHnsUsjwPshMk`,

          // USER
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX1VTRVIifQ.eqeCeZtvytNlHxGu3ZLiRRdLSJGHMP1hqUS0fulcc7U`,
          // Bob
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJib2IiLCJhdXRoIjoiUk9MRV9VU0VSIn0.Uya4e74X-R7YVedzMLtG9H5X8Zj-lyx120vd7ktkj_A`,

          // MOD
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX01PRCJ9.083AEQTw8BNF82Z-lV8TorYU-iS9s4TndmD9QZdMemY`

          // EDITOR
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX0VESVRPUiJ9.lYhRUsZHAz7MMNnheAQyOWh47AEDjPMg46jmeyBW3Ms`

          // ADMIN
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX0FETUlOIn0.NRnKPalO88BRTdPDDRfftYa7sf4jS2e8rlsbGC6eSaY`

          // PRIVATE USER
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX1VTRVIsUk9MRV9QUklWQVRFIn0.8C75htXT2kmT9HfnIHkhmUXjgCqzc4YszS8VhDLKdK0`

          // PRIVATE MOD
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX01PRCxST0xFX1BSSVZBVEUifQ.VcAIsvOBMZrLZklmEpiVP7E2n9tn-9vBwLPccRKvzpI`

          // PRIVATE ADMIN
          // Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjaHJpcyIsImF1dGgiOiJST0xFX0FETUlOLFJPTEVfUFJJVkFURSJ9._-_hnLRK1cNoU5wUANUujikDQdWiGCCyWvdrduB_lr0`

        },
      });
    }
    return next.handle(request);
  }
}
