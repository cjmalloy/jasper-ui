/// <reference types="vitest/globals" />
import { cacheKeyToTag } from './local';

describe('cacheKeyToTag', () => {
  it('should return tag as-is when no colon present', () => {
    expect(cacheKeyToTag('mytag')).toBe('mytag');
  });

  it('should convert tag:@origin to tag@origin', () => {
    expect(cacheKeyToTag('home:@myserver')).toBe('home@myserver');
  });

  it('should strip trailing colon from tag@origin:', () => {
    expect(cacheKeyToTag('home@myserver:')).toBe('home@myserver');
  });

  it('should use first origin from tag@origin:@default', () => {
    expect(cacheKeyToTag('home@myserver:@default')).toBe('home@myserver');
  });

  it('should handle tag: with no origin', () => {
    expect(cacheKeyToTag('home:')).toBe('home');
  });

  it('should handle empty string', () => {
    expect(cacheKeyToTag('')).toBe('');
  });

  it('should handle hierarchical tag with origin', () => {
    expect(cacheKeyToTag('people/murray:@origin1')).toBe('people/murray@origin1');
  });

  it('should handle hierarchical tag@origin with default', () => {
    expect(cacheKeyToTag('people/murray@origin1:@default')).toBe('people/murray@origin1');
  });
});
