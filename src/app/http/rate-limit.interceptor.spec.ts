/// <reference types="vitest/globals" />
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RateLimitInterceptor } from './rate-limit.interceptor';

describe('RateLimitInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [],
      providers: [
        RateLimitInterceptor,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: RateLimitInterceptor, multi: true },
      ]
    }).compileComponents();

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    const interceptor: RateLimitInterceptor = TestBed.inject(RateLimitInterceptor);
    expect(interceptor).toBeTruthy();
  });

  it('should pass through successful requests', async () => {
    const testData = { message: 'success' };

    const promise = new Promise<void>((resolve) => {
      httpClient.get('/test').subscribe(data => {
        expect(data).toEqual(testData);
        resolve();
      });
    });

    const req = httpTestingController.expectOne('/test');
    req.flush(testData);

    await promise;
  });

  it('should retry on 429 status with X-RateLimit-Retry-After header', async () => {
    vi.useFakeTimers();

    const testData = { message: 'success' };
    let attemptCount = 0;

    const promise = new Promise<void>((resolve) => {
      httpClient.get('/test').subscribe(data => {
        expect(data).toEqual(testData);
        expect(attemptCount).toBe(2); // Initial request + 1 retry
        resolve();
      });
    });

    // First request - returns 429
    const req1 = httpTestingController.expectOne('/test');
    attemptCount++;
    req1.flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': '1' }
    });

    // Wait for retry delay (1 second)
    await vi.advanceTimersByTimeAsync(1000);

    // Retry request - succeeds
    const req2 = httpTestingController.expectOne('/test');
    attemptCount++;
    req2.flush(testData);

    await promise;
    vi.useRealTimers();
  });

  it('should retry on 503 status with X-RateLimit-Retry-After header', async () => {
    vi.useFakeTimers();

    const testData = { message: 'success' };
    let attemptCount = 0;

    const promise = new Promise<void>((resolve) => {
      httpClient.get('/test').subscribe(data => {
        expect(data).toEqual(testData);
        expect(attemptCount).toBe(2); // Initial request + 1 retry
        resolve();
      });
    });

    // First request - returns 503
    const req1 = httpTestingController.expectOne('/test');
    attemptCount++;
    req1.flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'X-RateLimit-Retry-After': '1' }
    });

    // Wait for retry delay (1 second)
    await vi.advanceTimersByTimeAsync(1000);

    // Retry request - succeeds
    const req2 = httpTestingController.expectOne('/test');
    attemptCount++;
    req2.flush(testData);

    await promise;
    vi.useRealTimers();
  });

  it('should give up after max retries', async () => {
    vi.useFakeTimers();

    let attemptCount = 0;

    const promise = new Promise<void>((resolve) => {
      httpClient.get('/test').subscribe({
        next: () => { throw new Error('Should not succeed'); },
        error: (error) => {
          expect(error.status).toBe(429);
          expect(attemptCount).toBe(4); // Initial + 3 retries
          resolve();
        }
      });
    });

    // Initial request
    const req1 = httpTestingController.expectOne('/test');
    attemptCount++;
    req1.flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': '1' }
    });

    // Retry 1
    await vi.advanceTimersByTimeAsync(1000);
    const req2 = httpTestingController.expectOne('/test');
    attemptCount++;
    req2.flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': '1' }
    });

    // Retry 2
    await vi.advanceTimersByTimeAsync(1000);
    const req3 = httpTestingController.expectOne('/test');
    attemptCount++;
    req3.flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': '1' }
    });

    // Retry 3
    await vi.advanceTimersByTimeAsync(1000);
    const req4 = httpTestingController.expectOne('/test');
    attemptCount++;
    req4.flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': '1' }
    });

    await promise;
    vi.useRealTimers();
  });

  it('should not retry on other error status codes', async () => {
    let attemptCount = 0;

    const promise = new Promise<void>((resolve) => {
      httpClient.get('/test').subscribe({
        next: () => { throw new Error('Should not succeed'); },
        error: (error) => {
          expect(error.status).toBe(404);
          expect(attemptCount).toBe(1); // Only initial request, no retries
          resolve();
        }
      });
    });

    const req = httpTestingController.expectOne('/test');
    attemptCount++;
    req.flush(null, { status: 404, statusText: 'Not Found' });

    await promise;
  });

  it('should use exponential backoff when header is missing', async () => {
    vi.useFakeTimers();

    const testData = { message: 'success' };
    let attemptCount = 0;

    const promise = new Promise<void>((resolve) => {
      httpClient.get('/test').subscribe(data => {
        expect(data).toEqual(testData);
        expect(attemptCount).toBe(3); // Initial request + 2 retries
        resolve();
      });
    });

    // First request - returns 429 without header
    const req1 = httpTestingController.expectOne('/test');
    attemptCount++;
    req1.flush(null, {
      status: 429,
      statusText: 'Too Many Requests'
    });

    // Wait for first backoff (1 second = 2^0 * 1000)
    await vi.advanceTimersByTimeAsync(1000);

    // Retry 1 - returns 429
    const req2 = httpTestingController.expectOne('/test');
    attemptCount++;
    req2.flush(null, {
      status: 429,
      statusText: 'Too Many Requests'
    });

    // Wait for second backoff (2 seconds = 2^1 * 1000)
    await vi.advanceTimersByTimeAsync(2000);

    // Retry 2 - succeeds
    const req3 = httpTestingController.expectOne('/test');
    attemptCount++;
    req3.flush(testData);

    await promise;
    vi.useRealTimers();
  });

  it('should handle decimal retry values in X-RateLimit-Retry-After header', async () => {
    vi.useFakeTimers();

    const testData = { message: 'success' };
    let attemptCount = 0;

    const promise = new Promise<void>((resolve) => {
      httpClient.get('/test').subscribe(data => {
        expect(data).toEqual(testData);
        expect(attemptCount).toBe(2); // Initial request + 1 retry
        resolve();
      });
    });

    // First request - returns 429 with decimal retry value
    const req1 = httpTestingController.expectOne('/test');
    attemptCount++;
    req1.flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': '2.5' }
    });

    // Wait for retry delay (2.5 seconds = 2500ms)
    await vi.advanceTimersByTimeAsync(2500);

    // Retry request - succeeds
    const req2 = httpTestingController.expectOne('/test');
    attemptCount++;
    req2.flush(testData);

    await promise;
    vi.useRealTimers();
  });
});
