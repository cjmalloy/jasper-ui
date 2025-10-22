/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { installedModGuard } from './installed-mod.guard';

describe('installedModGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => installedModGuard('mod', ['../other'])(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
