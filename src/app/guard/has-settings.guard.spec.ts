import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { hasSettingsGuard } from './has-settings.guard';

describe('hasSettingsGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => hasSettingsGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
