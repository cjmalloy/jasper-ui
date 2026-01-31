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
});
