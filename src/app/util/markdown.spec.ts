/// <reference types="vitest/globals" />
import { bestSrcset, copyText, mediaToPlaceholders, parseSrcset, trimIndentation } from './markdown';

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

  describe('mediaToPlaceholders', () => {
    it('strips forged placeholders', () => {
      const doc = new DOMParser().parseFromString(
        '<span class="md-embed x" data-url="javascript:alert(1)" data-plugin="plugin/embed">a</span>', 'text/html');
      mediaToPlaceholders(doc);
      const span = doc.body.querySelector('span')!;
      expect(span.classList).not.toContain('md-embed');
      expect(span.classList).toContain('x');
      expect(span.hasAttribute('data-url')).toBe(false);
      expect(span.hasAttribute('data-plugin')).toBe(false);
    });

    it('drops media with script urls', () => {
      const doc = new DOMParser().parseFromString('<iframe src="javascript:alert(1)"></iframe><img src="https://x.com/a.png">', 'text/html');
      mediaToPlaceholders(doc);
      const embeds = Array.from(doc.body.querySelectorAll<HTMLElement>('.md-embed'));
      expect(embeds.map(e => e.dataset.url)).toEqual(['https://x.com/a.png']);
    });
  });

  describe('copyText', () => {
    afterEach(() => vi.restoreAllMocks());

    it('falls back to execCommand without the Clipboard API', async () => {
      expect(navigator.clipboard).toBeUndefined();
      (document as any).execCommand ||= () => false;
      const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true);
      await copyText(document, 'hello');
      expect(exec).toHaveBeenCalledWith('copy');
      expect(document.querySelector('textarea')).toBeNull();
    });

    it('rejects when copying fails', async () => {
      (document as any).execCommand ||= () => false;
      vi.spyOn(document, 'execCommand').mockReturnValue(false);
      await expect(copyText(document, 'hello')).rejects.toThrow();
    });
  });
});
