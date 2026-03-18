/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { TemplateService } from './template.service';

describe('TemplateService', () => {
  let service: TemplateService;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(TemplateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should preserve the root template empty tag when creating', async () => {
    const request = firstValueFrom(service.create({
      name: 'Root',
      config: { mod: '⚓️ Root' },
    } as any));

    const req = http.expectOne(request => request.url.endsWith('/api/v1/template'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.tag).toBe('');

    req.flush(null);
    await request;
  });
});
