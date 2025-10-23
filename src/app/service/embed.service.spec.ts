/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { EmbedService } from './embed.service';

describe('EmbedService', () => {
  let service: EmbedService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MarkdownModule.forRoot()],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(EmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
