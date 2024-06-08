import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { OEmbedService } from './oembed.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('OEmbedService', () => {
  let service: OEmbedService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(OEmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
