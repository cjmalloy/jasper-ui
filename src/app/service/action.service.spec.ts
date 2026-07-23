/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import { ActionService } from './action.service';

describe('ActionService', () => {
  let service: ActionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(ActionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store raw plugin values', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
    };
    const patch = vi.spyOn((service as any).refs, 'patch').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.plugin$('plugin/score', 42, ref));

    expect(patch).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', [{
      op: 'add',
      path: '/plugins',
      value: { 'plugin/score': 42 },
    }]);
    expect((ref as any).plugins['plugin/score']).toBe(42);
  });
});
