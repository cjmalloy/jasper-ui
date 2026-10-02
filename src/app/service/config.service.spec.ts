/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    service = TestBed.inject(ConfigService);
    vi.spyOn(service, 'base', 'get').mockReturnValue('http://localhost/');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults maxEmbedNesting to 3', () => {
    expect(service.maxEmbedNesting).toBe(3);
  });

  it('loads maxEmbedNesting from config.json', () => {
    service.load$.subscribe();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(service.base + 'assets/config.json').flush({ maxEmbedNesting: 5 });
    expect(service.maxEmbedNesting).toBe(5);
    http.verify();
  });

  it('keeps the default when maxEmbedNesting is omitted', () => {
    service.load$.subscribe();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(service.base + 'assets/config.json').flush({});
    expect(service.maxEmbedNesting).toBe(3);
    http.verify();
  });
});
