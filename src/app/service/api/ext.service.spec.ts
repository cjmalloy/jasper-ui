import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { ExtService } from './ext.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('ExtService', () => {
  let service: ExtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(ExtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
