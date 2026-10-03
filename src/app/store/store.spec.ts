/// <reference types="vitest/globals" />
import { computed } from '@angular/core';
import { Store } from './store';

describe('Store theme', () => {
  it('reactively derives the dark theme', () => {
    const store = new Store({} as any);
    const theme = computed(() => store.darkTheme() ? 'dark' : 'light');
    expect(theme()).toBe('light');

    store.theme.set('dark-theme');
    expect(theme()).toBe('dark');

    store.theme.set('light-theme');
    expect(theme()).toBe('light');
  });
});
