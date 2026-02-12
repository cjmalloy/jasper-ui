/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ThumbnailPipe } from './thumbnail.pipe';

describe('ThumbnailPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        ThumbnailPipe,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const pipe = TestBed.inject(ThumbnailPipe);
    expect(pipe).toBeTruthy();
  });
});
