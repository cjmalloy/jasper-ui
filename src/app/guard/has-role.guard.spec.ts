/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, provideRouter, RedirectCommand, Router } from '@angular/router';
import { Store } from '../store/store';

import { hasRoleGuard } from './has-role.guard';

describe('hasRoleGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => hasRoleGuard('admin', ['../other'])(...guardParameters));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });

  it('should allow admin', () => {
    TestBed.inject(Store).account.admin = true;
    expect(executeGuard(TestBed.inject(Router).routerState.snapshot.root, TestBed.inject(Router).routerState.snapshot)).toBe(true);
  });

  it('should redirect non-admin', () => {
    TestBed.inject(Store).account.admin = false;
    expect(executeGuard(TestBed.inject(Router).routerState.snapshot.root, TestBed.inject(Router).routerState.snapshot)).toBeInstanceOf(RedirectCommand);
  });
});
