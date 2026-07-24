/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, Subject } from 'rxjs';

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

  it('should update comments and plugins in one patch', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
      plugins: { existing: true },
    };
    const patch = vi.spyOn((service as any).refs, 'patch').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.update$({
      comment: '{"level":2,"score":42,"final":false}',
      plugins: { 'plugin/score': 42 },
    }, ref));

    expect(patch).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', [
      {
        op: 'add',
        path: '/comment',
        value: '{"level":2,"score":42,"final":false}',
      },
      {
        op: 'add',
        path: '/plugins/plugin~1score',
        value: 42,
      },
    ]);
  });

  it('should serialize updates for the same ref', () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
      comment: '',
    };
    const first = new Subject<string>();
    const patch = vi.spyOn((service as any).refs, 'patch')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(of('2026-01-01T00:00:02Z'));

    service.update({ comment: 'final' }, ref);
    service.update({ comment: 'reset' }, ref);

    expect(patch).toHaveBeenCalledTimes(1);
    first.next('2026-01-01T00:00:01Z');
    first.complete();

    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.calls[1][2]).toBe('2026-01-01T00:00:01Z');
    expect(ref.comment).toBe('reset');
  });
});
