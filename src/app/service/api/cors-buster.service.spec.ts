import { TestBed } from '@angular/core/testing';

import { CorsBusterService } from './cors-buster.service';

describe('CorsBusterService', () => {
  let service: CorsBusterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CorsBusterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
