import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { CorsBusterService } from './cors-buster.service';

describe('CorsBusterService', () => {
  let service: CorsBusterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    });
    service = TestBed.inject(CorsBusterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
