/// <reference types="vitest/globals" />
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { ModService } from './mod.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('ModService', () => {
  let service: ModService;

  beforeEach(() => {
    // Mock CSS.supports for jsdom environment
    if (typeof CSS === 'undefined') {
      (globalThis as any).CSS = {
        supports: vi.fn().mockReturnValue(true)
      };
    } else if (!CSS.supports) {
      CSS.supports = vi.fn().mockReturnValue(true) as any;
    }
    
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(ModService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
