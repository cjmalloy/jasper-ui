/// <reference types="vitest/globals" />
import {
  storyboardAnimation,
  storyboardHeight,
  storyboardMargin,
  storyboardSize,
  storyboardUrl,
  storyboardWidth,
} from './storyboard';

describe('storyboard presentation', () => {
  it('formats a valid landscape storyboard', () => {
    const storyboard = { cols: 5, rows: 4, width: 320, height: 180 };

    expect(storyboardSize(storyboard)).toBe('500% 400%');
    expect(storyboardWidth(storyboard)).toBe('48px');
    expect(storyboardHeight(storyboard)).toBe('27px');
    expect(storyboardMargin(storyboard)).toBe('10.5px 10px 0 0');
    expect(storyboardAnimation(storyboard)?.value).toBe('storyboard-slide-5x4 8.00s linear infinite');
  });

  it('formats a valid portrait storyboard', () => {
    const storyboard = { cols: 2, rows: 3, width: 100, height: 200 };

    expect(storyboardWidth(storyboard)).toBe('24px');
    expect(storyboardHeight(storyboard)).toBe('48px');
    expect(storyboardMargin(storyboard)).toBe('0 22px 0 12px');
  });

  it('rejects invalid or excessive grids', () => {
    expect(storyboardSize({ cols: 0, rows: 2 })).toBeNull();
    expect(storyboardSize({ cols: 101, rows: 100 })).toBeNull();
    expect(storyboardWidth({ cols: 2, rows: 2, width: 'invalid', height: 100 })).toBeNull();
    expect(storyboardAnimation({ cols: 1, rows: 1 })).toBeNull();
  });

  it('escapes URLs for CSS', () => {
    expect(storyboardUrl('https://example.com/a"b\\c.jpg'))
      .toBe('url("https://example.com/a\\"b\\\\c.jpg")');
    expect(storyboardUrl(null)).toBeNull();
  });
});
