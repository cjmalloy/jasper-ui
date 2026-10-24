/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OEmbedService, oembedUrl } from './oembed.service';

describe('OEmbedService', () => {
  let service: OEmbedService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(OEmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should look up x.com links as twitter.com', () => {
    expect(oembedUrl('https://x.com/jack/status/20')).toBe('https://twitter.com/jack/status/20');
    expect(oembedUrl('https://www.x.com/jack/status/20')).toBe('https://twitter.com/jack/status/20');
    expect(oembedUrl('https://mobile.x.com/jack/status/20')).toBe('https://twitter.com/jack/status/20');
    expect(oembedUrl('https://twitter.com/jack/status/20')).toBe('https://twitter.com/jack/status/20');
    expect(oembedUrl('https://example.com/x.com/a')).toBe('https://example.com/x.com/a');
    expect(oembedUrl('https://box.com/a')).toBe('https://box.com/a');
  });
});
