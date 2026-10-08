/// <reference types="vitest/globals" />
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { catchError, EMPTY } from 'rxjs';

import { CsrfInterceptor } from './csrf.interceptor';

describe('CsrfInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [],
    providers: [
        CsrfInterceptor,
        { provide: HTTP_INTERCEPTORS, useExisting: CsrfInterceptor, multi: true },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
}));

  it('should be created', () => {
    const interceptor: CsrfInterceptor = TestBed.inject(CsrfInterceptor);
    expect(interceptor).toBeTruthy();
  });

  for (const detail of [
    `Invalid CSRF Token 'x' was found on the request parameter '_csrf' or header 'X-XSRF-TOKEN'.`,
    'Could not verify the provided CSRF token because no token was found to compare.',
  ]) {
    it(`retries once on 403: ${detail}`, () => {
      const http = TestBed.inject(HttpClient);
      const ctrl = TestBed.inject(HttpTestingController);
      let result: any;
      http.post('/api/v1/proxy', 'data').subscribe(res => result = res);
      ctrl.expectOne('/api/v1/proxy').flush({ detail }, { status: 403, statusText: 'OK' });
      ctrl.expectOne('/api/v1/proxy').flush({ ok: true });
      expect(result).toEqual({ ok: true });
      ctrl.verify();
    });
  }

  it('does not retry other 403s', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    let error: any;
    http.post('/api/v1/ref', 'data').pipe(catchError(err => { error = err; return EMPTY; })).subscribe();
    ctrl.expectOne('/api/v1/ref').flush({ detail: 'Access is denied' }, { status: 403, statusText: 'OK' });
    expect(error.status).toBe(403);
    ctrl.verify();
  });
});
