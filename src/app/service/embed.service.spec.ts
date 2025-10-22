/// <reference types="vitest/globals" />
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { EmbedService } from './embed.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('EmbedService', () => {
  let service: EmbedService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]),
        MarkdownModule.forRoot()],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(EmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
