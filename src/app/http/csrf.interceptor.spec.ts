/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CsrfInterceptor } from './csrf.interceptor';

describe('CsrfInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [],
    providers: [
        CsrfInterceptor,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
}));

  it('should be created', () => {
    const interceptor: CsrfInterceptor = TestBed.inject(CsrfInterceptor);
    expect(interceptor).toBeTruthy();
  });
});
