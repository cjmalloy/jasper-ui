/// <reference types="vitest/globals" />
import {
  bestSrcset,
  copyText,
  markIslands,
  matchBlocks,
  MdIsland,
  morphRange,
  pairBlocks,
  mdBlocks,
  mediaToPlaceholders,
  parseSrcset,
  sanitizeMarkdown,
  wrapTables
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

    it('rejects candidates with multiple or invalid descriptors', () => {
      expect(parseSrcset('bad.png 999w 2x, a.png 1.5x, b.png 0w, c.png 2y, d.png 100w')).toEqual([
        { url: 'a.png', descriptor: '1.5x' },
        { url: 'd.png', descriptor: '100w' },
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

  describe('wrapTables', () => {
    it('wraps tables once and keeps the source map on the table', () => {
      const doc = new DOMParser().parseFromString(
        '<p>a</p><table aria-posinset="3"><tr><td>x</td></tr></table>', 'text/html');
      wrapTables(doc);
      wrapTables(doc);
      const wrappers = doc.body.querySelectorAll('.md-table');
      expect(wrappers.length).toBe(1);
      expect(wrappers[0].tagName).toBe('DIV');
      expect(wrappers[0].hasAttribute('aria-posinset')).toBe(false);
      const table = wrappers[0].firstElementChild!;
      expect(wrappers[0].childElementCount).toBe(1);
      expect(table.tagName).toBe('TABLE');
      expect(table.getAttribute('aria-posinset')).toBe('3');
      expect(doc.body.firstElementChild!.tagName).toBe('P');
    });

    it('wraps tables in a wrapper with other content', () => {
      const doc = new DOMParser().parseFromString(
        '<div class="md-table"><p>x</p><table><tr><td>x</td></tr></table></div>', 'text/html');
      wrapTables(doc);
      expect(doc.body.querySelector('table')!.parentElement!.childElementCount).toBe(1);
      expect(doc.body.querySelectorAll('.md-table').length).toBe(2);
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
      const doc = new DOMParser().parseFromString('<img src="javascript:alert(1)"><img src="https://x.com/a.png">', 'text/html');
      mediaToPlaceholders(doc);
      const embeds = Array.from(doc.body.querySelectorAll<HTMLElement>('.md-embed'));
      expect(embeds.map(e => e.dataset.url)).toEqual(['https://x.com/a.png']);
    });
  });

  describe('sanitizeMarkdown', () => {
    it('removes svg images and image inputs', () => {
      const doc = new DOMParser().parseFromString(
        '<svg><image href="https://x.com/a.png"></image><filter><feImage href="https://x.com/b.png"></feImage></filter><rect></rect></svg><input type="IMAGE" src="https://x.com/c.png">', 'text/html');
      sanitizeMarkdown(doc);
      expect(doc.body.querySelector('input')).toBeNull();
      expect(Array.from(doc.body.querySelectorAll('svg *')).map(e => e.localName)).toEqual(['filter', 'rect']);
    });

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

  it('ignores closing tags inside html comments when grouping blocks', () => {
    const blocks = mdBlocks([
      { type: 'html', raw: '<details>\n<!-- </details> -->\n', sourceMap: 0 },
      { type: 'space', raw: '\n', sourceMap: 30 },
      { type: 'paragraph', raw: 'hidden', sourceMap: 31 },
      { type: 'html', raw: '</details>', sourceMap: 37 },
    ]);
    expect(blocks.length).toBe(1);
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

  describe('islands', () => {
    function root(html: string) {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div;
    }

    it('marks only the outermost islands and ignores source maps in keys', () => {
      const a = root('<p aria-posinset="0">x <a href="/a"><span class="md-embed" data-url="u"></span></a></p><pre aria-posinset="5"><code>c</code></pre>');
      const b = root('<p aria-posinset="1">y <a href="/a"><span class="md-embed" data-url="u"></span></a></p><pre aria-posinset="9"><code>c</code></pre>');
      const ia = Array.from(markIslands(a).values());
      const ib = Array.from(markIslands(b).values());
      expect(ia.length).toBe(2);
      expect(ia.map(i => i.key)).toEqual(ib.map(i => i.key));
      expect(a.querySelector('p')!.innerHTML).toBe('x <!--md-island--><a href="/a"><span class="md-embed" data-url="u"></span></a><!--/md-island-->');
    });

    it('morphs in place, keeping identical islands and hydrating new ones', () => {
      const host = root('');
      host.className = 'md';
      const live = root('<p aria-posinset="0">x <span class="md-embed" data-url="u"></span></p>');
      const liveIslands = markIslands(live);
      const hydrated: string[] = [];
      const hydrate = (start: Comment, island: MdIsland) => {
        const el = start.nextSibling as HTMLElement;
        const out = document.createElement('b');
        out.textContent = el.dataset.url!;
        el.replaceWith(out);
        hydrated.push(out.textContent);
        island.cleanup = vi.fn();
      };
      for (const [s, i] of liveIslands) hydrate(s, i);
      host.append(...Array.from(live.childNodes));
      const p = host.firstElementChild!;
      const kept = p.querySelector('b')!;
      const [first] = liveIslands.values();

      const next = root('<p aria-posinset="2">xy <span class="md-embed" data-url="u"></span> <span class="md-embed" data-url="v"></span></p>');
      morphRange(host, host.firstChild, null, next, { host, live: liveIslands, next: markIslands(next), hydrate });

      expect(host.firstElementChild).toBe(p);
      expect(p.getAttribute('aria-posinset')).toBe('2');
      expect(p.querySelector('b')).toBe(kept);
      expect(hydrated).toEqual(['u', 'v']);
      expect(p.textContent).toBe('xy u v');
      expect(liveIslands.size).toBe(2);

      morphRange(host, host.firstChild, null, root('<p>z</p>'), { host, live: liveIslands, next: new Map(), hydrate });
      expect(first.cleanup).toHaveBeenCalled();
      expect(liveIslands.size).toBe(0);
      expect(host.innerHTML).toBe('<p>z</p>');
    });

    it('pairs changed blocks that share an island in the same position', () => {
      const islands = (...keys: string[]) => new Map(keys.map(key => [document.createComment(''), { key, end: document.createComment('') }]));
      const old = [{ islands: islands('a') }, { islands: islands('b') }, { islands: islands() }];
      const next = [islands('a', 'x'), islands('y'), islands()];
      expect(pairBlocks(old, [undefined, undefined, old[2]], i => next[i])).toEqual([old[0], undefined, undefined]);
      expect(pairBlocks(old, [undefined, old[1], undefined], i => next[i])).toEqual([old[0], undefined, undefined]);
    });
  });
});
