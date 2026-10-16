/// <reference types="vitest/globals" />
import { HttpClient, provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { catchError, EMPTY } from 'rxjs';

import { csrfInterceptor } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('does not add a CSRF header to GET requests', () => {
    http.get('/test').subscribe();
    const req = httpMock.expectOne('/test');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush({});
  });

  it('adds a CSRF header to POST requests', () => {
    http.post('/test', {}).subscribe();
    const req = httpMock.expectOne('/test');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(true);
    req.flush({});
  });

  for (const detail of [
    `Invalid CSRF Token 'x' was found on the request parameter '_csrf' or header 'X-XSRF-TOKEN'.`,
    'Could not verify the provided CSRF token because no token was found to compare.',
  ]) {
    it(`retries once on 403: ${detail}`, () => {
      let result: any;
      http.post('/api/v1/proxy', 'data').subscribe(res => result = res);
      httpMock.expectOne('/api/v1/proxy').flush({ detail }, { status: 403, statusText: 'OK' });
      httpMock.expectOne('/api/v1/proxy').flush({ ok: true });
      expect(result).toEqual({ ok: true });
    });
  }

  for (const status of [403, 0]) {
    it(`retries once with the new cookie if it changed (status ${status})`, () => {
      const http = TestBed.inject(HttpClient);
      const ctrl = TestBed.inject(HttpTestingController);
      document.cookie = 'XSRF-TOKEN=old';
      let result: any;
      http.post('/api/v1/proxy', 'data').subscribe(res => result = res);
      const first = ctrl.expectOne('/api/v1/proxy');
      expect(first.request.headers.get('X-XSRF-TOKEN')).toBe('old');
      document.cookie = 'XSRF-TOKEN=new';
      first.flush(null, { status, statusText: 'Forbidden' });
      const retry = ctrl.expectOne('/api/v1/proxy');
      expect(retry.request.headers.get('X-XSRF-TOKEN')).toBe('new');
      retry.flush({ ok: true });
      expect(result).toEqual({ ok: true });
      ctrl.verify();
    });
  }

  it('retries a network error once even if the cookie did not change', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    document.cookie = 'XSRF-TOKEN=same';
    let error: any;
    http.post('/api/v1/ref', 'data').pipe(catchError(err => { error = err; return EMPTY; })).subscribe();
    ctrl.expectOne('/api/v1/ref').error(new ProgressEvent('error'));
    ctrl.expectOne('/api/v1/ref').error(new ProgressEvent('error'));
    expect(error.status).toBe(0);
    ctrl.verify();
  });

  it('does not retry other 403s', () => {
    let error: any;
    http.post('/api/v1/ref', 'data').pipe(catchError(err => { error = err; return EMPTY; })).subscribe();
    httpMock.expectOne('/api/v1/ref').flush({ detail: 'Access is denied' }, { status: 403, statusText: 'OK' });
    expect(error.status).toBe(403);
  });
});
