import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { StompService } from './stomp.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ConfigService } from '../config.service';

describe('StompService', () => {
  let service: StompService;
  let configService: ConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(StompService);
    configService = TestBed.inject(ConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('hostUrl', () => {
    it('should not duplicate port when using relative API config', () => {
      // Test the current behavior by setting relative config
      configService.api = '.';
      
      const hostUrl = service.hostUrl;
      console.log('Generated hostUrl:', hostUrl);
      
      // The hostUrl should only contain one occurrence of the port number
      const portMatches = hostUrl.match(/:\d+/g);
      if (portMatches) {
        expect(portMatches.length).toBe(1); // Should only have one port in the URL
      }
      
      // Should not contain duplicate port patterns like :8081:8081
      expect(hostUrl).not.toMatch(/:\d+:\d+/);
    });

    it('should demonstrate the bug is fixed', () => {
      configService.api = '.';
      
      const hostUrl = service.hostUrl;
      console.log('Fixed hostUrl:', hostUrl);
      console.log('location.host:', location.host);
      console.log('location.port:', location.port);
      
      // After the fix, hostUrl should equal ws:// + location.host
      // where location.host already includes the port
      const expectedUrl = service.getWsProtocol() + location.host;
      expect(hostUrl).toBe(expectedUrl);
      
      // Should not contain duplicate port patterns like :9876:9876
      expect(hostUrl).not.toMatch(/:\d+:\d+/);
    });

    it('should handle different relative API configurations', () => {
      const testConfigs = ['.', '/', './'];
      
      testConfigs.forEach(config => {
        configService.api = config;
        const hostUrl = service.hostUrl;
        
        // Should start with ws:// or wss://
        expect(hostUrl).toMatch(/^wss?:\/\//);
        
        // Should not have duplicate ports
        expect(hostUrl).not.toMatch(/:\d+:\d+/);
      });
    });

    it('should handle absolute URLs correctly', () => {
      // Test with protocol-relative URL
      configService.api = '//api.example.com:8080';
      expect(service.hostUrl).toBe('ws://api.example.com:8080');

      // Test with full https URL
      configService.api = 'https://api.example.com:8080';
      expect(service.hostUrl).toBe('wss://api.example.com:8080');

      // Test with full http URL
      configService.api = 'http://api.example.com:8080';
      expect(service.hostUrl).toBe('ws://api.example.com:8080');
    });
  });
});
