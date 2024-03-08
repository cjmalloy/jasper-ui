import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthzService } from './authz.service';

describe('AuthzService', () => {
  let service: AuthzService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,
      ],
    });
    service = TestBed.inject(AuthzService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
