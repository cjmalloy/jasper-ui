import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { conditionGuard } from './condition.guard';

describe('conditionGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => conditionGuard(() => true, ['../other'])(...guardParameters));

  beforeEach(async () => {
    await TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
