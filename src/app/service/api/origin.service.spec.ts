import { TestBed } from "@angular/core/testing";

import { OriginService } from "./origin.service";
import { HttpClientModule } from "@angular/common/http";

describe('OriginService', () => {
  let service: OriginService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ]
    });
    service = TestBed.inject(OriginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
