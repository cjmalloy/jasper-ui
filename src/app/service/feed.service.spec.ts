import { TestBed } from "@angular/core/testing";

import { FeedService } from "./feed.service";
import { HttpClientModule } from "@angular/common/http";

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ]
    });
    service = TestBed.inject(FeedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
