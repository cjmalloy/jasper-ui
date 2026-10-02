/// <reference types="vitest/globals" />
import { signal } from '@angular/core';
import { computedBy } from './computed-by';

describe('computedBy', () => {
  it('should cache results per argument', () => {
    let calls = 0;
    const fn = computedBy((arg: string) => {
      calls++;
      return arg.toUpperCase();
    });
    expect(fn('a')).toBe('A');
    expect(fn('a')).toBe('A');
    expect(fn('b')).toBe('B');
    expect(calls).toBe(2);
  });

  it('should recompute when a dependency changes', () => {
    const prefix = signal('x');
    let calls = 0;
    const fn = computedBy((arg: string) => {
      calls++;
      return prefix() + arg;
    });
    expect(fn('a')).toBe('xa');
    expect(fn('a')).toBe('xa');
    prefix.set('y');
    expect(fn('a')).toBe('ya');
    expect(calls).toBe(2);
  });
});
