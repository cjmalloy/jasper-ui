/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { CanMatchFn } from '@angular/router';

import { clearLastSelected } from './last-selected.guard';

describe('lastSelectedGuard', () => {
  const executeGuard: CanMatchFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => clearLastSelected(...guardParameters));

  beforeEach(async () => {
    await TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
