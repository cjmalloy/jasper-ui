import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OAuthService, OAuthStorage } from 'angular-oauth2-oidc';

import { AuthnService } from './authn.service';

describe('AuthnService', () => {
  let service: AuthnService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
      ],
      providers: [
        { provide: OAuthService, useValue: {} },
        { provide: OAuthStorage, useValue: {} },
      ],
    });
    service = TestBed.inject(AuthnService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
