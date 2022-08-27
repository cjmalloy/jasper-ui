import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { OEmbedService } from './oembed.service';

describe('OEmbedService', () => {
  let service: OEmbedService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    });
    service = TestBed.inject(OEmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
