/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { CanDeactivateFn } from '@angular/router';

import { HasChanges, pendingChangesGuard } from './pending-changes.guard';

describe('pendingChangesGuard', () => {
  const executeGuard: CanDeactivateFn<HasChanges> = (...guardParameters) =>
      TestBed.runInInjectionContext(() => pendingChangesGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
