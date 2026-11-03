/// <reference types="vitest/globals" />
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { sharedSuggestions } from './input.type';

describe('sharedSuggestions', () => {
  it('loads suggestions once per parent field', async () => {
    const load = vi.fn(() => of(['a', 'b']));
    const key = () => of([]);
    const list = {};
    expect(await firstValueFrom(sharedSuggestions(list, key, load))).toEqual(['a', 'b']);
    expect(await firstValueFrom(sharedSuggestions(list, key, load))).toEqual(['a', 'b']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads suggestions again for a new form', async () => {
    const load = vi.fn(() => of(['a']));
    const key = () => of([]);
    await firstValueFrom(sharedSuggestions({}, key, load));
    await firstValueFrom(sharedSuggestions({}, key, load));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps different suggestions in the same parent apart', async () => {
    const parent = {};
    expect(await firstValueFrom(sharedSuggestions(parent, 'a', () => of(['a'])))).toEqual(['a']);
    expect(await firstValueFrom(sharedSuggestions(parent, 'b', () => of(['b'])))).toEqual(['b']);
  });
});
