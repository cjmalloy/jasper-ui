/// <reference types="vitest/globals" />
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { ScrapeService } from './scrape.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('ScrapeService', () => {
  let service: ScrapeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(ScrapeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
