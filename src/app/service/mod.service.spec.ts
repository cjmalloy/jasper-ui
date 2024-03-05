import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ModService } from './mod.service';

describe('ModService', () => {
  let service: ModService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    });
    service = TestBed.inject(ModService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
