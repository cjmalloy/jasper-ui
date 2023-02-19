import { TestBed } from '@angular/core/testing';

import { ImageDimService } from './image-dim.service';

describe('ImageDimService', () => {
  let service: ImageDimService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageDimService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
