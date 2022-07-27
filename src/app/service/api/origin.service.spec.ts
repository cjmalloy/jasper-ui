import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OriginService } from './origin.service';

describe('OriginService', () => {
  let service: OriginService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
      ],
    });
    service = TestBed.inject(OriginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
