import { TestBed } from "@angular/core/testing";

import { ExtService } from "./ext.service";
import { HttpClientModule } from "@angular/common/http";

describe('ExtService', () => {
  let service: ExtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ]
    });
    service = TestBed.inject(ExtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
