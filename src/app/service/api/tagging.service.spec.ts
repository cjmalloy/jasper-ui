import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TaggingService } from './tagging.service';

describe('TaggingService', () => {
  let service: TaggingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
      ],
    });
    service = TestBed.inject(TaggingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
