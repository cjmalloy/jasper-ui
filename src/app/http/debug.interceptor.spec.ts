import { TestBed } from '@angular/core/testing';

import { DebugInterceptor } from './debug.interceptor';

describe('DebugInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      DebugInterceptor
      ]
  }));

  it('should be created', () => {
    const interceptor: DebugInterceptor = TestBed.inject(DebugInterceptor);
    expect(interceptor).toBeTruthy();
  });
});
