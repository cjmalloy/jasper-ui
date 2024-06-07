import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { ModService } from './mod.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('ModService', () => {
  let service: ModService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(ModService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
