import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { AuthzService } from './authz.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('AuthzService', () => {
  let service: AuthzService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(AuthzService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
