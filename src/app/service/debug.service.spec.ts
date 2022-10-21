import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { OAuthService, OAuthStorage } from 'angular-oauth2-oidc';

import { DebugService } from './debug.service';

describe('DebugService', () => {
  let service: DebugService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
      ],
      providers: [
        { provide: OAuthService, useValue: {} },
        { provide: OAuthStorage, useValue: {} },
      ],
    });
    service = TestBed.inject(DebugService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
