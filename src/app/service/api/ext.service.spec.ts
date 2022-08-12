import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ExtService } from './ext.service';

describe('ExtService', () => {
  let service: ExtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    });
    service = TestBed.inject(ExtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
