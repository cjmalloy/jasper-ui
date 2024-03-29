import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { OriginService } from './origin.service';

describe('OriginService', () => {
  let service: OriginService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    });
    service = TestBed.inject(OriginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
