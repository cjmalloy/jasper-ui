/// <reference types="vitest/globals" />
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

import { PwaService } from './pwa.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('PwaService', () => {
  let service: PwaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [{
            provide: SwUpdate,
            useValue: {
                versionUpdates: { subscribe() { } },
                unrecoverable: { subscribe() { } },
            },
        }, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(PwaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
