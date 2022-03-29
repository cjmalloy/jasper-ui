import { TestBed } from "@angular/core/testing";

import { TemplateService } from "./template.service";
import { HttpClientModule } from "@angular/common/http";

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ]
    });
    service = TestBed.inject(TemplateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
