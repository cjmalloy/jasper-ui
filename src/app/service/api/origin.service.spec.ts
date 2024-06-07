import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { OriginService } from './origin.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('OriginService', () => {
  let service: OriginService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(OriginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
