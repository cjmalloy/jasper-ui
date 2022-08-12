import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RefService } from './ref.service';

describe('RefService', () => {
  let service: RefService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    });
    service = TestBed.inject(RefService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
