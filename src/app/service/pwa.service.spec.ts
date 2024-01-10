import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { SwUpdate } from '@angular/service-worker';

import { PwaService } from './pwa.service';

describe('PwaService', () => {
  let service: PwaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [{
        provide: SwUpdate,
        useValue: {
          versionUpdates: { subscribe() {} },
          unrecoverable: { subscribe() {} },
        },
      }],
    });
    service = TestBed.inject(PwaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
