/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TagPreviewPipe } from './tag-preview.pipe';

describe('TagPreviewPipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        TagPreviewPipe,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const pipe = TestBed.inject(TagPreviewPipe);
    expect(pipe).toBeTruthy();
  });
});
