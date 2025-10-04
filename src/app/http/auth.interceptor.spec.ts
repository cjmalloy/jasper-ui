import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { AuthInterceptor } from './auth.interceptor';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('CsrfInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [
      AuthInterceptor,
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting()
    ],
  }));

  it('should be created', () => {
    const interceptor: AuthInterceptor = TestBed.inject(AuthInterceptor);
    expect(interceptor).toBeTruthy();
  });
});
