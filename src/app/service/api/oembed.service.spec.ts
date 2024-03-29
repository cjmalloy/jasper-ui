import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { OEmbedService } from './oembed.service';

describe('OEmbedService', () => {
  let service: OEmbedService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
    });
    service = TestBed.inject(OEmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
