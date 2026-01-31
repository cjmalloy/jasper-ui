import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { VisibilityService } from './visibility.service';

describe('VisibilityService', () => {
  let service: VisibilityService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({});
    service = TestBed.inject(VisibilityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
