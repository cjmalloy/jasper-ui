/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { finalize, Subject } from 'rxjs';

import { EXT_UPDATE_RATE_LIMIT_MS, StompService } from './stomp.service';

describe('StompService', () => {
  let service: StompService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

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

  it('should stop watching an Ext after two updates within one minute', () => {
    vi.useFakeTimers();
    const updates = new Subject<any>();
    vi.spyOn(service, 'watch').mockReturnValue(updates);
    const received = vi.fn();
    const stopped = vi.fn();

    service.watchExt('test').pipe(finalize(stopped)).subscribe(received);
    updates.next({ body: '{"tag":"test","origin":"","name":"First"}' });
    vi.advanceTimersByTime(EXT_UPDATE_RATE_LIMIT_MS - 1);
    updates.next({ body: '{"tag":"test","origin":"","name":"Second"}' });

    expect(received).toHaveBeenCalledOnce();
    expect(stopped).toHaveBeenCalledOnce();
    expect(updates.observed).toBe(false);
    vi.useRealTimers();
  });

  it('should keep watching Ext updates at least one minute apart', () => {
    vi.useFakeTimers();
    const updates = new Subject<any>();
    vi.spyOn(service, 'watch').mockReturnValue(updates);
    const received = vi.fn();

    service.watchExt('test').subscribe(received);
    updates.next({ body: '{"tag":"test","origin":"","name":"First"}' });
    vi.advanceTimersByTime(EXT_UPDATE_RATE_LIMIT_MS);
    updates.next({ body: '{"tag":"test","origin":"","name":"Second"}' });

    expect(received).toHaveBeenCalledTimes(2);
    expect(updates.observed).toBe(true);
    vi.useRealTimers();
  });
});
