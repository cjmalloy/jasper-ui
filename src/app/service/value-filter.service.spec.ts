/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { RefService } from './api/ref.service';
import { ValueFilterService } from './value-filter.service';

describe('ValueFilterService', () => {
  let page: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let service: ValueFilterService;

  beforeEach(() => {
    page = vi.fn<(...args: any[]) => any>(args => of({
      content: [{ url: '', tags: [args.sort[0].endsWith('ASC') ? 'plugin/duration/pt2m' : 'plugin/duration/pt2h'] }],
    }));
    TestBed.configureTestingModule({
      providers: [{ provide: RefService, useValue: { page: (...args: any[]) => page(...args) } }],
    });
    service = TestBed.inject(ValueFilterService);
  });

  it('finds the smallest and largest values in the query', async () => {
    expect(await firstValueFrom(service.extent('tags->plugin/duration:dur', 'duration', 'music'))).toEqual([120, 7200]);
    expect(page.mock.calls.map(([args]) => args.query)).toEqual(['plugin/duration:music', 'plugin/duration:music']);
  });

  it('keeps the local origin wildcard', async () => {
    await firstValueFrom(service.extent('tags->plugin/duration:dur', 'duration', '*'));
    expect(page.mock.calls[0][0].query).toBe('plugin/duration:*');
  });

  it('reloads the range each time', async () => {
    await firstValueFrom(service.extent('tags->plugin/duration:dur', 'duration'));
    await firstValueFrom(service.extent('tags->plugin/duration:dur', 'duration'));
    expect(page).toHaveBeenCalledTimes(4);
  });
});
