import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { StompService } from './stomp.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ConfigService } from '../config.service';

describe('StompService', () => {
  let service: StompService;
  let configService: jasmine.SpyObj<ConfigService>;

  beforeEach(() => {
    const configSpy = jasmine.createSpyObj('ConfigService', ['token', 'websockets'], {
      api: '.',
      token: 'test-token',
      websockets: false
    });

    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [
      provideHttpClient(withInterceptorsFromDi()), 
      provideHttpClientTesting(),
      { provide: ConfigService, useValue: configSpy }
    ]
});
    service = TestBed.inject(StompService);
    configService = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('hostUrl', () => {
    it('should use location.host without duplicating port when api is local', () => {
      // For local API paths (., /, ./), it should use location.host only
      // location.host already includes the port, so we shouldn't add location.port
      
      configService.api = '.';
      const hostUrl = service.hostUrl;
      
      // Should use ws protocol for http and include location.host
      // The test environment uses localhost, but the key point is that 
      // we shouldn't see the port duplicated
      expect(hostUrl.startsWith('ws://')).toBeTruthy();
      expect(hostUrl).not.toContain(location.port + location.port); // No port duplication
      
      // Verify it's using location.host correctly (should be ws://localhost:9876, not ws://localhost:98769876)
      expect(hostUrl).toBe('ws://' + location.host);
    });

    it('should handle different API configurations correctly', () => {
      // Test with full https URL
      Object.defineProperty(configService, 'api', { value: 'https://api.example.com', writable: true });
      expect(service.hostUrl).toBe('wss://api.example.com');
      
      // Test with protocol-relative URL (should use current location protocol)
      Object.defineProperty(configService, 'api', { value: '//api.example.com', writable: true });
      const expectedProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
      expect(service.hostUrl).toBe(expectedProtocol + 'api.example.com');
      
      // Test with http URL
      Object.defineProperty(configService, 'api', { value: 'http://api.example.com', writable: true });
      expect(service.hostUrl).toBe('ws://api.example.com');
      
      // Test with plain domain (should use current location protocol)
      Object.defineProperty(configService, 'api', { value: 'api.example.com', writable: true });
      const expectedProtocolForPlain = location.protocol === 'https:' ? 'wss://' : 'ws://';
      expect(service.hostUrl).toBe(expectedProtocolForPlain + 'api.example.com');
    });
  });
});
