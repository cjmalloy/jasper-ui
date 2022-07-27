import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RefService } from './ref.service';

describe('RefService', () => {
  let service: RefService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
      ],
    });
    service = TestBed.inject(RefService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
