/// <reference types="vitest/globals" />
import { generateStoryboardKeyframes } from '../mods/thumbnail';

describe('generateStoryboardKeyframes', () => {
  it('should return empty string for zero cols', () => {
    expect(generateStoryboardKeyframes('test', 0, 3)).toBe('');
  });

  it('should return empty string for zero rows', () => {
    expect(generateStoryboardKeyframes('test', 4, 0)).toBe('');
  });

  it('should return empty string for negative cols', () => {
    expect(generateStoryboardKeyframes('test', -4, 3)).toBe('');
  });

  it('should return empty string for negative rows', () => {
    expect(generateStoryboardKeyframes('test', 4, -3)).toBe('');
  });

  it('should generate keyframes with correct frame count', () => {
    const result = generateStoryboardKeyframes('anim', 4, 3);
    expect(result).toContain('@keyframes anim {');
    // 4*3 = 12 frames
    const frameCount = (result.match(/background-position/g) || []).length;
    expect(frameCount).toBe(12);
  });

  it('should use 0% for single-column x position', () => {
    const result = generateStoryboardKeyframes('anim', 1, 2);
    expect(result).toContain('background-position: 0% 0%');
    expect(result).toContain('background-position: 0% 100%');
  });

  it('should use 0% for single-row y position', () => {
    const result = generateStoryboardKeyframes('anim', 2, 1);
    expect(result).toContain('background-position: 0% 0%');
    expect(result).toContain('background-position: 100% 0%');
  });

  it('should produce correct positions for a 2x2 grid', () => {
    const result = generateStoryboardKeyframes('anim', 2, 2);
    expect(result).toContain('background-position: 0% 0%');
    expect(result).toContain('background-position: 100% 0%');
    expect(result).toContain('background-position: 0% 100%');
    expect(result).toContain('background-position: 100% 100%');
  });
});

