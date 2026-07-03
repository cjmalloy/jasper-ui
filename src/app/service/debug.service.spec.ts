/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DebugService } from './debug.service';

describe('DebugService', () => {
  let service: DebugService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(DebugService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('generates debug JWTs without an empty audience claim', async () => {
    const token = await (service as any).getDebugToken('', 'ROLE_ADMIN');
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload).toMatchObject({
      verified_email: true,
      sub: 'debug',
      auth: 'ROLE_ADMIN',
    });
    expect(payload).not.toHaveProperty('aud');
  });
});
