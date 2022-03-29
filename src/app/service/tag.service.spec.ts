import { TestBed } from "@angular/core/testing";

import { TagService } from "./tag.service";
import { HttpClientModule } from "@angular/common/http";

describe('TagService', () => {
  let service: TagService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ]
    });
    service = TestBed.inject(TagService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
