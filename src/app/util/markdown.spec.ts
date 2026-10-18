/// <reference types="vitest/globals" />
import { bestSrcset, parseSrcset, trimIndentation } from './markdown';

describe('markdown util', () => {
  describe('parseSrcset', () => {
    it('parses candidates with descriptors', () => {
      expect(parseSrcset('a.png 1x, b.png 2x')).toEqual([
        { url: 'a.png', descriptor: '1x' },
        { url: 'b.png', descriptor: '2x' },
      ]);
    });

    it('handles commas inside urls', () => {
      expect(parseSrcset('https://x.com/w_100,h_100/a.png 100w,https://x.com/w_200,h_200/a.png 200w')).toEqual([
        { url: 'https://x.com/w_100,h_100/a.png', descriptor: '100w' },
        { url: 'https://x.com/w_200,h_200/a.png', descriptor: '200w' },
      ]);
    });

    it('handles candidates without descriptors and extra whitespace', () => {
      expect(parseSrcset('  a.png,\n b.png  2x  ')).toEqual([
        { url: 'a.png', descriptor: '' },
        { url: 'b.png', descriptor: '2x' },
      ]);
    });

    it('handles empty input', () => {
      expect(parseSrcset('')).toEqual([]);
      expect(parseSrcset(null)).toEqual([]);
    });
  });

  describe('bestSrcset', () => {
    it('picks the largest candidate', () => {
      expect(bestSrcset('big.png 800w, small.png 100w')).toBe('big.png');
      expect(bestSrcset('a.png, b.png 2x')).toBe('b.png');
    });
  });

  describe('trimIndentation', () => {
    it('removes common indentation', () => {
      expect(trimIndentation('  a\n    b')).toBe('a\n  b');
      expect(trimIndentation('a\n  b')).toBe('a\n  b');
    });
  });
});
