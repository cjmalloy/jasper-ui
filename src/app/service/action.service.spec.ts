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

  it('should store a single plugin value', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
    };
    const patch = vi.spyOn((service as any).refs, 'patch').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.plugin$('plugin/score', 42, ref));

    expect(patch).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', [
      { op: 'add', path: '/tags', value: ['plugin/score'] },
      { op: 'add', path: '/plugins', value: { 'plugin/score': 42 } },
    ]);
  });

  it('should not add a tag op when the tag is already present', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
      tags: ['plugin/score'],
      plugins: { 'plugin/score': 0 },
    };
    const patch = vi.spyOn((service as any).refs, 'patch').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.plugin$('plugin/score', 99, ref));

    expect(patch).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', [
      { op: 'add', path: '/plugins/plugin~1score', value: 99 },
    ]);
  });

  it('should store multiple plugin values in one patch', async () => {
    const ref = {
      url: 'https://example.com',
      origin: '',
      modifiedString: '2026-01-01T00:00:00Z',
      plugins: { existing: true },
    };
    const patch = vi.spyOn((service as any).refs, 'patch').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.plugin$(
      'plugin/a', { enabled: true },
      'plugin/b', 42,
      ref,
    ));

    expect(patch).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', [
      { op: 'add', path: '/tags', value: ['plugin/a', 'plugin/b'] },
      { op: 'add', path: '/plugins/plugin~1a', value: { enabled: true } },
      { op: 'add', path: '/plugins/plugin~1b', value: 42 },
    ]);
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
    const patch = vi.spyOn((service as any).refs, 'patch').mockReturnValue(of('2026-01-01T00:00:01Z'));

    await firstValueFrom(service.plugin$(
      'plugin/a', { enabled: true },
      'plugin/b', 42,
      ref,
    ));

    expect(patch).toHaveBeenCalledWith(ref.url, '', '2026-01-01T00:00:00Z', [
      { op: 'add', path: '/tags/-', value: 'plugin/b' },
      { op: 'add', path: '/plugins/plugin~1a', value: { enabled: true } },
      { op: 'add', path: '/plugins/plugin~1b', value: 42 },
    ]);
  });
});
