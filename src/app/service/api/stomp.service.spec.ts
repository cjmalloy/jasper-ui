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

  it('should construct hostUrl correctly for relative API paths', () => {
    // Test different config.api values that trigger the location.host usage
    const testCases = ['.', '/', './'];
    
    testCases.forEach(apiPath => {
      service['config'].api = apiPath;
      const hostUrl = service.hostUrl;
      
      // Should start with ws:// or wss://
      expect(hostUrl.startsWith('ws://') || hostUrl.startsWith('wss://')).toBeTruthy();
      
      // Should not contain double ports (like :8080:8080 or similar patterns)
      const hostPart = hostUrl.replace(/^wss?:\/\//, '');
      const portMatches = hostPart.match(/:\d+/g);
      
      // Should have at most one port specification
      expect(portMatches?.length || 0).toBeLessThanOrEqual(1);
    });
  });
});
