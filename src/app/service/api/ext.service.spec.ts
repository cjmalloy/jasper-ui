import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { ExtService } from './ext.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('ExtService', () => {
  let service: ExtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(ExtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return default ext for uncached requests', () => {
    const tag = 'test-tag';
    const origin = 'test-origin';
    
    const result = service.getCachedExt(tag, origin);
    
    result.subscribe(ext => {
      expect(ext).toBeTruthy();
      expect(ext.tag).toBe(tag);
      expect(ext.origin).toBe(origin);
      expect(ext.name).toBe('');
    });
  });

  it('should return cached ext for subsequent requests', () => {
    const tag = 'test-tag';
    const origin = 'test-origin';
    
    const result1 = service.getCachedExt(tag, origin);
    const result2 = service.getCachedExt(tag, origin);
    
    // Should return the same observable instance (cached)
    expect(result1).toBe(result2);
  });

  it('should handle empty tag and origin correctly', () => {
    const result = service.getCachedExt('', '');
    
    result.subscribe(ext => {
      expect(ext).toBeTruthy();
      expect(ext.tag).toBe('');
      expect(ext.origin).toBe('');
      expect(ext.name).toBe('');
    });
  });
});
