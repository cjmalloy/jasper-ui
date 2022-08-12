import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { BackupService } from './backup.service';

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    });
    service = TestBed.inject(BackupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
