import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { RefService } from './ref.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('RefService', () => {
  let service: RefService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(RefService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
