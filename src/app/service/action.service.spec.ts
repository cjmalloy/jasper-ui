/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, NEVER, of, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref } from '../model/ref';

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

  it('should store a single plugin value', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
    };
    const merge = vi.spyOn((service as any).refs, 'merge').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.patch$({ plugins: { 'plugin/score': 42 } }, ref));

    expect(merge).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', {
      tags: ['plugin/score'],
      plugins: { 'plugin/score': 42 },
    });
  });

  it('should not add a tag when the tag is already present', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
      tags: ['plugin/score'],
      plugins: { 'plugin/score': 0 },
    };
    const merge = vi.spyOn((service as any).refs, 'merge').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.patch$({ plugins: { 'plugin/score': 99 } }, ref));

    expect(merge).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', {
      plugins: { 'plugin/score': 99 },
    });
  });

  it('should store multiple plugin values in one patch', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
      comment: '',
      plugins: { existing: true },
    };
    const merge = vi.spyOn((service as any).refs, 'merge').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.patch$({
      comment: 'map',
      plugins: {
        'plugin/a': { enabled: true },
        'plugin/b': 42,
      },
    }, ref));

    expect(merge).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', {
      comment: 'map',
      tags: ['plugin/a', 'plugin/b'],
      plugins: {
        'plugin/a': { enabled: true },
        'plugin/b': 42,
      },
    });
    expect(ref.comment).toBe('map');
    expect(ref.plugins).toEqual({
      existing: true,
      'plugin/a': { enabled: true },
      'plugin/b': 42,
    });
  });

  it('should only add tags that are missing when some are already present', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
      tags: ['plugin/a'],
      plugins: { 'plugin/a': null },
    };
    const merge = vi.spyOn((service as any).refs, 'merge').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.patch$({
      plugins: {
        'plugin/a': { enabled: true },
        'plugin/b': 42,
      },
    }, ref));

    expect(merge).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', {
      tags: ['plugin/a', 'plugin/b'],
      plugins: {
        'plugin/a': { enabled: true },
        'plugin/b': 42,
      },
    });
  });

  describe('websocket origins', () => {
    const url = 'comment:game';
    let watchRef: ReturnType<typeof vi.spyOn>;
    let page: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      watchRef = vi.spyOn((service as any).stomp, 'watchRef').mockReturnValue(NEVER);
      page = vi.spyOn((service as any).refs, 'page').mockReturnValue(of(Page.of<Ref>([
        { url, origin: '@sub' },
        { url, origin: '@other' },
      ])));
      (service as any).store.origins.list = ['', '@sub', '@other', '@missing'];
    });

    it('watch only subscribes to origins that have the Ref', () => {
      service.watch({ url, origin: '@sub' }).ref$.subscribe(() => {});

      expect(page).toHaveBeenCalledWith({ url, obsolete: null, page: 0 });
      expect(watchRef.mock.calls).toEqual([[url, '@sub'], [url, '@other']]);
    });

    it('append only subscribes to origins that have the Ref', () => {
      service.append({ url, origin: '@sub' }).updates$.subscribe(() => {});

      expect(page).toHaveBeenCalledWith({ url, obsolete: null, page: 0 });
      expect(watchRef.mock.calls).toEqual([[url, '@sub'], [url, '@other']]);
    });

    it('subscribes to origins from every page of copies', () => {
      page.mockImplementation((args: any) => of({
        content: [{ url, origin: args.page ? '@second' : '@first' }],
        page: { number: args.page, size: 1, totalElements: 2, totalPages: 2 },
      }));
      service.watch({ url, origin: '' }).ref$.subscribe(() => {});

      expect(page.mock.calls).toEqual([[{ url, obsolete: null, page: 0 }], [{ url, obsolete: null, page: 1 }]]);
      expect(watchRef.mock.calls).toEqual([[url, ''], [url, '@first'], [url, '@second']]);
    });

    it('falls back to the Ref origin when copies cannot be loaded', () => {
      page.mockReturnValue(throwError(() => ({ status: 500 })));
      service.watch({ url, origin: '' }).ref$.subscribe(() => {});

      expect(watchRef.mock.calls).toEqual([[url, '']]);
    });
  });
});
