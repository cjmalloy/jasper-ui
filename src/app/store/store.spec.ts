/// <reference types="vitest/globals" />
import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterStore } from './router';
import { Store } from './store';

describe('Store theme', () => {
  it('reactively derives the dark theme', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: RouterStore, useValue: {} },
      ],
    });
    const store = TestBed.runInInjectionContext(() => new Store());
    const theme = computed(() => store.darkTheme() ? 'dark' : 'light');
    expect(theme()).toBe('light');

    store.theme.set('dark-theme');
    expect(theme()).toBe('dark');

    store.theme.set('light-theme');
    expect(theme()).toBe('light');
  });
});
