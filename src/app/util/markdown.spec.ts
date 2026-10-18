/// <reference types="vitest/globals" />
import {
  bestSrcset,
  copyText,
  matchBlocks,
  mdBlocks,
  mediaToPlaceholders,
  parseSrcset,
  sanitizeMarkdown,
  trimIndentation
} from './markdown';

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

    it('removes svg images', () => {
      const doc = new DOMParser().parseFromString(
        '<svg><image href="https://x.com/a.png"></image><filter><feImage href="https://x.com/b.png"></feImage></filter><rect></rect></svg>', 'text/html');
      mediaToPlaceholders(doc);
      expect(Array.from(doc.body.querySelectorAll('svg *')).map(e => e.localName)).toEqual(['filter', 'rect']);
    });

    it('drops media with script urls', () => {
      const doc = new DOMParser().parseFromString('<iframe src="javascript:alert(1)"></iframe><img src="https://x.com/a.png">', 'text/html');
      mediaToPlaceholders(doc);
      const embeds = Array.from(doc.body.querySelectorAll<HTMLElement>('.md-embed'));
      expect(embeds.map(e => e.dataset.url)).toEqual(['https://x.com/a.png']);
    });
  });

  describe('sanitizeMarkdown', () => {
    it('removes stylesheets and restricts inline css', () => {
      const doc = new DOMParser().parseFromString(
        '<div><style>body{display:none}</style><p style="position: fixed; z-index: 9; color: red; background-image: url(https://x.com/a.png)">a</p>' +
        '<span style="position: relative; top: 1em; height: 2em; vertical-align: -0.5em">b</span><table background="https://x.com/b.png"></table></div>', 'text/html');
      sanitizeMarkdown(doc);
      expect(doc.body.querySelector('style')).toBeNull();
      expect(doc.body.querySelector('[background]')).toBeNull();
      const p = doc.body.querySelector('p')!;
      expect(p.style.position).toBe('');
      expect(p.style.zIndex).toBe('');
      expect(p.style.backgroundImage).toBe('');
      expect(p.style.color).toBe('red');
      const span = doc.body.querySelector('span')!;
      expect(span.style.position).toBe('relative');
      expect(span.style.top).toBe('1em');
      expect(span.style.height).toBe('2em');
      expect(span.style.verticalAlign).toBe('-0.5em');
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

  describe('mdBlocks', () => {
    it('skips space tokens and groups unbalanced html', () => {
      const blocks = mdBlocks([
        { type: 'html', raw: '<details>', sourceMap: 0 },
        { type: 'space', raw: '\n\n', sourceMap: 9 },
        { type: 'paragraph', raw: 'a <br>', sourceMap: 11 },
        { type: 'html', raw: '</details>', sourceMap: 17 },
        { type: 'space', raw: '\n\n', sourceMap: 27 },
        { type: 'paragraph', raw: 'b', sourceMap: 29 },
      ]);
      expect(blocks.map(b => [b.key, b.offset])).toEqual([
        ['<details>\n\na <br></details>', 0],
        ['b', 29],
      ]);
    });
  });

  describe('matchBlocks', () => {
    const keys = (...k: string[]) => k.map(key => ({ key }));

    it('keeps common prefix and suffix', () => {
      const old = keys('a', 'b', 'c');
      expect(matchBlocks(old, keys('a', 'x', 'c'))).toEqual([old[0], undefined, old[2]]);
    });

    it('matches duplicate keys in order without moving blocks', () => {
      const old = keys('a', 'b', 'a', 'c');
      expect(matchBlocks(old, keys('x', 'a', 'a', 'y'))).toEqual([undefined, old[0], old[2], undefined]);
      expect(matchBlocks(old, keys('c', 'b'))).toEqual([old[3], undefined]);
    });
  });
});
