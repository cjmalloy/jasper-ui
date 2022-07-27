import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MarkdownModule } from 'ngx-markdown';

import { EmbedService } from './embed.service';

describe('EmbedService', () => {
  let service: EmbedService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        MarkdownModule.forRoot(),
      ],
    });
    service = TestBed.inject(EmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
