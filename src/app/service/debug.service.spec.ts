import { TestBed } from '@angular/core/testing';

import { RenamedDebugService } from './debug.service';

describe('DebugService', () => {
  let service: RenamedDebugService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RenamedDebugService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
