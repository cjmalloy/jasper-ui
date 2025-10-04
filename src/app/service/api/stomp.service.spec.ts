import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { StompService } from './stomp.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('StompService', () => {
  let service: StompService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(StompService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should construct hostUrl correctly without duplicating port', () => {
    // Set config api to a specific value to avoid the local path
    service['config'].api = '//example.com:8080';
    
    const hostUrl = service.hostUrl;
    
    // Should use the configured API without location.host + location.port
    expect(hostUrl).toBe('ws://example.com:8080');
  });

  it('should handle local API configuration correctly', () => {
    // Test the specific case where the bug was present
    service['config'].api = '.';
    
    const hostUrl = service.hostUrl;
    
    // Should use location.host which already includes port, not duplicate it
    // The actual value will depend on the test environment, but importantly
    // it should not contain obviously doubled ports
    expect(hostUrl).toMatch(/^ws:\/\/[^:]+(:[\d]+)?$/);
    // More specific check - should not have more than 5 consecutive digits (which would indicate port duplication)
    expect(hostUrl).not.toMatch(/:\d{5,}/);
  });
});
