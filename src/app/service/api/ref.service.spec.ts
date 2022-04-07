import { TestBed } from "@angular/core/testing";

import { RefService } from "./ref.service";
import { HttpClientModule } from "@angular/common/http";

describe('RefService', () => {
  let service: RefService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ]
    });
    service = TestBed.inject(RefService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
