/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { hasRoleGuard } from './has-role.guard';

describe('hasRoleGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => hasRoleGuard('admin', ['../other'])(...guardParameters));

  beforeEach(async () => {
    await TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
