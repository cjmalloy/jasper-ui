/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ExtService, EXT_BATCH_THROTTLE_MS } from './ext.service';

describe('ExtService', () => {
  let service: ExtService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(ExtService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return cached ext immediately', async () => {
    const testExt = { tag: 'test', origin: '', name: 'Test' };
    service.prefillCache(testExt);

    const start = Date.now();
    const ext = await firstValueFrom(service.getCachedExt('test', ''));
    const elapsed = Date.now() - start;
    
    expect(ext).toEqual(testExt);
    expect(elapsed).toBeLessThan(10); // Should be immediate
  });

  it('should batch uncached ext requests', async () => {
    // Request multiple exts
    const promise1 = firstValueFrom(service.getCachedExt('tag1', ''));
    const promise2 = firstValueFrom(service.getCachedExt('tag2', ''));
    const promise3 = firstValueFrom(service.getCachedExt('tag3', ''));

    // Wait for batch throttle
    await new Promise(resolve => setTimeout(resolve, EXT_BATCH_THROTTLE_MS + 50));
    
    // Verify only one request is made
    const requests = httpMock.match(req => req.url.includes('/api/v1/ext/page'));
    expect(requests.length).toBe(1);
    
    // Verify the query includes all three tags
    const query = requests[0].request.params.get('query');
    expect(query).toContain('tag1');
    expect(query).toContain('tag2');
    expect(query).toContain('tag3');
    
    // Respond with the data
    requests[0].flush({
      content: [
        { tag: 'tag1', origin: '', name: 'Tag 1', modified: '2024-01-01T00:00:00Z' },
        { tag: 'tag2', origin: '', name: 'Tag 2', modified: '2024-01-01T00:00:00Z' },
        { tag: 'tag3', origin: '', name: 'Tag 3', modified: '2024-01-01T00:00:00Z' },
      ],
      page: { number: 0, size: 3, totalElements: 3, totalPages: 1 }
    });
    
    // Verify all subscribers received their results
    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
    expect(result1.tag).toBe('tag1');
    expect(result2.tag).toBe('tag2');
    expect(result3.tag).toBe('tag3');
  });
});
