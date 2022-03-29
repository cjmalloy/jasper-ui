import { TestBed } from "@angular/core/testing";

import { PluginService } from "./plugin.service";
import { HttpClientModule } from "@angular/common/http";

describe('PluginService', () => {
  let service: PluginService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ]
    });
    service = TestBed.inject(PluginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
