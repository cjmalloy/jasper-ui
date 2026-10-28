import { ComponentRef, ViewContainerRef } from '@angular/core';
import DOMPurify from 'dompurify';
import { escape } from 'lodash-es';
import { mountMermaid } from './mermaid';
import { localTag, tagOrigin } from './tag';

export interface MdContext {
  vc: ViewContainerRef;
  origin: string;
  mermaid: boolean;
  clipboard: boolean;
}

/**
 * Hydrate a rendered markdown host. Returns a cleanup function.
 */
export type MdHydrator = (host: HTMLElement, ctx: MdContext) => (() => void) | void;

export interface SrcsetCandidate {
  url: string;
  descriptor: string;
}

/**
 * Parse a srcset attribute following the HTML spec candidate rules.
 * URLs may contain commas, so do not naively split on ', '.
 */
export function parseSrcset(srcset?: string | null): SrcsetCandidate[] {
  const result: SrcsetCandidate[] = [];
  if (!srcset) return result;
  const ws = /[\t\n\f\r ]/;
  const n = srcset.length;
  let i = 0;
  while (i < n) {
    while (i < n && (ws.test(srcset[i]) || srcset[i] === ',')) i++;
    if (i >= n) break;
    let start = i;
    while (i < n && !ws.test(srcset[i])) i++;
    let url = srcset.substring(start, i);
    let descriptor = '';
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      start = i;
      let parens = false;
      while (i < n) {
        const c = srcset[i];
        if (c === '(') parens = true;
        else if (c === ')') parens = false;
        else if (c === ',' && !parens) break;
        i++;
      }
      descriptor = srcset.substring(start, i).trim();
      i++;
    }
    if (url && validDescriptor(descriptor)) result.push({ url, descriptor });
  }
  return result;
}

/**
 * Only a single positive width or density descriptor is supported.
 */
function validDescriptor(descriptor: string) {
  if (!descriptor) return true;
  if (/^\d+w$/.test(descriptor)) return parseInt(descriptor, 10) > 0;
  if (/^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?x$/i.test(descriptor)) return parseFloat(descriptor) > 0;
  return false;
}

/**
 * Pick the largest candidate from a srcset.
 */
export function bestSrcset(srcset?: string | null): string | undefined {
  const candidates = parseSrcset(srcset);
  let best: SrcsetCandidate | undefined;
  let bestSize = -1;
  for (const c of candidates) {
    const size = parseFloat(c.descriptor) || 1;
    if (size >= bestSize) {
      best = c;
      bestSize = size;
    }
  }
  return best?.url;
}

function resolveUrl(url: string, base: string) {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

function mediaUrl(el: Element, base: string): string | undefined {
  const srcset = bestSrcset(el.getAttribute('srcset'));
  if (srcset) return resolveUrl(srcset, base);
  const src = el.getAttribute('src');
  if (src) return resolveUrl(src, base);
  return undefined;
}

function unsafeUrl(url: string) {
  return /^\s*(javascript:|vbscript:|data:text\/html)/i.test(url);
}

function placeholder(doc: Document, el: HTMLElement, plugin: string, url?: string, alt?: string | null) {
  if (!url || unsafeUrl(url)) {
    el.remove();
    return;
  }
  const p = doc.createElement('span');
  p.className = 'md-embed';
  p.dataset.url = url;
  p.dataset.plugin = plugin;
  if (el.title) p.dataset.title = el.title;
  if (alt) p.dataset.alt = alt;
  if (el.style?.width) p.dataset.width = el.style.width;
  if (el.style?.height) p.dataset.height = el.style.height;
  el.replaceWith(p);
}

/**
 * Allow any URI scheme, such as Jasper's tag:, comment: or wiki:, except script and data URIs.
 * Data URIs are still allowed on media where DOMPurify permits them.
 */
const SAFE_URI = /^(?!(?:javascript|vbscript|data):)/i;

/**
 * Sanitize an inert parsed markdown document in place.
 */
export function sanitizeMarkdown(doc: Document) {
  DOMPurify.sanitize(doc.body, {
    IN_PLACE: true,
    FORBID_TAGS: ['style'],
    FORBID_ATTR: ['background'],
    ALLOWED_URI_REGEXP: SAFE_URI,
  });
  doc.body.querySelectorAll<HTMLElement>('[style]').forEach(sanitizeStyle);
  // These load images directly, bypassing the embed pipeline
  doc.body.querySelectorAll('input[type="image" i]').forEach(t => t.remove());
  doc.body.querySelectorAll('svg *').forEach(t => {
    if (t.localName === 'image' || t.localName === 'feImage') t.remove();
  });
}

/**
 * Inline CSS properties allowed in untrusted markdown. Covers basic formatting,
 * media dimensions and the properties KaTeX emits.
 */
const STYLE_PROPS = /^(color|background-color|opacity|font-(weight|style|size|family|variant)|line-height|letter-spacing|word-spacing|text-(align|decoration(-[a-z]+)*|transform|indent|shadow)|white-space|vertical-align|display|visibility|(min-|max-)?(width|height)|(margin|padding)(-(top|right|bottom|left))?|border(-(top|right|bottom|left))?(-(width|style|color))?|border-collapse|border-spacing|border(-[a-z]+)?-radius|top|right|bottom|left|list-style(-type|-position)?|float|clear|overflow(-[xy])?|box-sizing|word-break|overflow-wrap)$/;

/**
 * Restrict untrusted inline CSS to safe formatting properties.
 * Positioning is limited to static or relative, and no property may load resources.
 */
export function sanitizeStyle(el: HTMLElement) {
  const style = el.style;
  for (const prop of Array.from({ length: style.length }, (_, i) => style.item(i))) {
    const value = style.getPropertyValue(prop);
    if (/url\(|image-set\(|image\(|expression\(|element\(/i.test(value)) {
      style.removeProperty(prop);
    } else if (prop === 'position') {
      if (!['static', 'relative'].includes(value.trim().toLowerCase())) style.removeProperty(prop);
    } else if (!STYLE_PROPS.test(prop)) {
      style.removeProperty(prop);
    }
  }
  if (!style.length) el.removeAttribute('style');
}

/**
 * Convert all media elements in an inert document into
 * <span class="md-embed" data-url> placeholders so nothing loads before hydration.
 */
export function mediaToPlaceholders(doc: Document) {
  const base = doc.baseURI || location.href;
  // Placeholders are reserved, don't trust any already in the content
  doc.body.querySelectorAll<HTMLElement>('.md-embed').forEach(t => {
    t.classList.remove('md-embed');
    for (const attr of ['data-url', 'data-plugin', 'data-title', 'data-alt', 'data-width', 'data-height']) {
      t.removeAttribute(attr);
    }
  });
  doc.body.querySelectorAll<HTMLPictureElement>('picture').forEach(t => {
    const source = t.querySelector('source');
    const img = t.querySelector('img');
    placeholder(doc, t, 'plugin/image', (source && mediaUrl(source, base)) || (img && mediaUrl(img, base)) || undefined, img?.alt);
  });
  doc.body.querySelectorAll<HTMLImageElement>('img').forEach(t => {
    placeholder(doc, t, 'plugin/image', mediaUrl(t, base), t.alt);
  });
  doc.body.querySelectorAll<HTMLAudioElement>('audio').forEach(t => {
    const source = t.querySelector('source');
    placeholder(doc, t, 'plugin/audio', (source && mediaUrl(source, base)) || mediaUrl(t, base));
  });
  doc.body.querySelectorAll<HTMLVideoElement>('video').forEach(t => {
    const source = t.querySelector('source');
    placeholder(doc, t, 'plugin/video', (source && mediaUrl(source, base)) || mediaUrl(t, base));
  });
  doc.body.querySelectorAll('source, track').forEach(t => t.remove());
}

/**
 * Wrap every table in a horizontally scrollable <div class="md-table"> container.
 * The source map stays on the table.
 */
export function wrapTables(doc: Document) {
  doc.body.querySelectorAll('table').forEach(t => {
    const parent = t.parentElement;
    if (parent?.classList.contains('md-table') && parent.childElementCount === 1) return;
    const div = doc.createElement('div');
    div.className = 'md-table';
    t.replaceWith(div);
    div.append(t);
  });
}

/**
 * Add origins to user tag links.
 * @param doc inert parsed markdown document
 * @param origin origin to append to user links without existing origins
 * @param lookup origin map for the given origin
 */
export function fixUserTags(doc: Document, origin = '', lookup?: ReadonlyMap<string, string>) {
  doc.body.querySelectorAll<HTMLAnchorElement>('.user.tag').forEach(t => {
    const text = t.textContent || '';
    const userOrigin = tagOrigin(text);
    if (userOrigin) {
      if (lookup?.has(userOrigin)) {
        const tag = localTag(text) + lookup.get(userOrigin);
        t.textContent = tag;
        t.setAttribute('href', '/tag/' + escape(tag));
        t.title = $localize`User ` + tag;
      }
    } else if (origin) {
      t.setAttribute('href', t.getAttribute('href') + origin);
    }
  });
}

/**
 * Attach an inert document to a live host in a single DOM operation.
 */
export function attachMarkdown(host: HTMLElement, doc: Document) {
  const body = host.ownerDocument.adoptNode(doc.body);
  host.replaceChildren(...Array.from(body.childNodes));
}

/**
 * Wrap a <pre> with a relatively positioned container and toolbar.
 */
function preToolbar(pre: HTMLElement) {
  let div = pre.parentElement;
  if (div?.classList.contains('md-pre')) {
    const existing = div.querySelector<HTMLElement>(':scope > .markdown-clipboard-toolbar');
    if (existing) return existing;
  } else {
    div = pre.ownerDocument.createElement('div');
    div.className = 'md-pre';
    pre.replaceWith(div);
    div.appendChild(pre);
  }
  const toolbar = pre.ownerDocument.createElement('div');
  toolbar.className = 'markdown-clipboard-toolbar';
  div.appendChild(toolbar);
  return toolbar;
}

export const mermaidHydrator: MdHydrator = (host, ctx) => {
  const cleanup: (() => void)[] = [];
  host.querySelectorAll<HTMLElement>('pre > code.language-mermaid').forEach(code => {
    const pre = code.parentElement!;
    const text = code.textContent || '';
    const container = host.ownerDocument.createElement('div');
    container.className = 'md-mermaid';
    const posinset = pre.getAttribute('aria-posinset');
    if (posinset !== null) {
      container.setAttribute('aria-posinset', posinset);
      pre.removeAttribute('aria-posinset');
    }
    pre.replaceWith(container);
    container.appendChild(pre);
    const render = () => {
      const div = host.ownerDocument.createElement('div');
      div.className = 'mermaid';
      container.replaceChildren(div);
      cleanup.push(mountMermaid(div, text));
    };
    if (ctx.mermaid) {
      render();
    } else {
      const button = host.ownerDocument.createElement('button');
      button.type = 'button';
      button.className = 'mermaid-render';
      button.textContent = $localize`render`;
      button.title = $localize`Render diagram`;
      button.addEventListener('click', render, { once: true });
      cleanup.push(() => button.removeEventListener('click', render));
      preToolbar(pre).appendChild(button);
    }
  });
  return () => cleanup.forEach(fn => fn());
};

export const prismHydrator: MdHydrator = host => {
  const prism = (globalThis as any).Prism;
  if (typeof prism?.highlightAllUnder !== 'function') return;
  host.querySelectorAll('pre code:not([class*="language-"])').forEach(c => c.classList.add('language-none'));
  prism.highlightAllUnder(host);
};

function execCopy(doc: Document, text: string) {
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  doc.body.appendChild(textarea);
  try {
    textarea.select();
    if (!doc.execCommand('copy')) throw new Error('Copy command failed');
  } finally {
    textarea.remove();
  }
}

/**
 * Copy text to the clipboard, falling back to execCommand when the
 * Clipboard API is unavailable (e.g. insecure contexts).
 */
export async function copyText(doc: Document, text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to execCommand
    }
  }
  execCopy(doc, text);
}

export const clipboardHydrator: MdHydrator = (host, ctx) => {
  if (!ctx.clipboard) return;
  const cleanup: (() => void)[] = [];
  host.querySelectorAll<HTMLElement>('pre').forEach(pre => {
    const button = host.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'markdown-clipboard-button';
    button.textContent = $localize`Copy`;
    let timeout: any;
    const status = (className: string, text: string) => {
      button.classList.remove('copied', 'copy-failed');
      button.classList.add(className);
      button.textContent = text;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        button.classList.remove(className);
        button.textContent = $localize`Copy`;
      }, 3000);
    };
    const copy = () => {
      copyText(host.ownerDocument, pre.textContent || '')
        .then(() => status('copied', $localize`Copied`))
        .catch(err => {
          console.error(err);
          status('copy-failed', $localize`Copy failed`);
        });
    };
    button.addEventListener('click', copy);
    cleanup.push(() => {
      clearTimeout(timeout);
      button.removeEventListener('click', copy);
    });
    preToolbar(pre).appendChild(button);
  });
  return () => cleanup.forEach(fn => fn());
};

/**
 * Assign absolute source offsets to a token tree as `token.sourceMap`.
 */
export function assignSourceMap<T extends any[]>(tokens: T): T {
  let pos = 0;
  const walk = (ts: any[]) => {
    for (const t of ts) {
      t.sourceMap = pos;
      if (t.tokens?.length) walk(t.tokens);
      else if (t.items?.length) walk(t.items);
      else if (t.rows?.length) walk(t.rows);
      pos = t.sourceMap + (t.raw?.length ?? 0);
    }
  };
  walk(tokens);
  return tokens;
}

/**
 * A top-level markdown block that is rendered and hydrated on its own.
 */
export interface MdBlock {
  key: string;
  offset: number;
  tokens: any[];
}

const VOID_TAGS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;

/**
 * Remove HTML comments, including an unterminated trailing comment.
 */
function stripComments(html: string) {
  let result = '';
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('<!--', i);
    if (start < 0) {
      result += html.substring(i);
      break;
    }
    result += html.substring(i, start);
    const end = html.indexOf('-->', start + 2);
    if (end < 0) break;
    i = end + 3;
  }
  return result;
}

function htmlDepth(html: string) {
  let depth = 0;
  for (const m of stripComments(html).matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    if (m[3] || VOID_TAGS.test(m[2])) continue;
    depth += m[1] ? -1 : 1;
  }
  return depth;
}

/**
 * Group top-level tokens into independently renderable blocks.
 * Unbalanced HTML blocks are grouped with the following tokens until closed,
 * since the HTML parser would otherwise nest them differently.
 */
export function mdBlocks(tokens: any[]): MdBlock[] {
  const result: MdBlock[] = [];
  let current: MdBlock | undefined;
  let depth = 0;
  for (const t of tokens) {
    if (t.type === 'space' && depth <= 0) continue;
    if (!current || depth <= 0) {
      depth = 0;
      current = { key: '', offset: t.sourceMap ?? 0, tokens: [] };
      result.push(current);
    }
    current.tokens.push(t);
    current.key += t.raw ?? '';
    if (t.type === 'html') depth += htmlDepth(t.raw || '');
  }
  return result;
}

/**
 * Match old blocks to new blocks by key, keeping their order.
 * @return for each new block, the matching old block or undefined if it must be rendered
 */
export function matchBlocks<T extends { key: string }>(old: T[], next: { key: string }[]): (T | undefined)[] {
  const result: (T | undefined)[] = new Array(next.length).fill(undefined);
  let start = 0;
  while (start < old.length && start < next.length && old[start].key === next[start].key) {
    result[start] = old[start];
    start++;
  }
  let oldEnd = old.length;
  let nextEnd = next.length;
  while (oldEnd > start && nextEnd > start && old[oldEnd - 1].key === next[nextEnd - 1].key) {
    result[--nextEnd] = old[--oldEnd];
  }
  const lookup = new Map<string, number[]>();
  for (let i = start; i < oldEnd; i++) {
    const list = lookup.get(old[i].key);
    if (list) list.push(i);
    else lookup.set(old[i].key, [i]);
  }
  let last = start - 1;
  for (let i = start; i < nextEnd; i++) {
    const list = lookup.get(next[i].key);
    while (list?.length && list[0] <= last) list.shift();
    if (list?.length) {
      last = list.shift()!;
      result[i] = old[last];
    }
  }
  return result;
}

/**
 * Shift the source map of the host's own elements between two sibling nodes.
 * Elements in nested markdown hosts are left alone.
 * @param host markdown host (.md)
 * @param from first node of the range
 * @param to node after the range, or null for the end of the host
 * @param delta offset to add to aria-posinset
 */
export function shiftSourceMap(host: HTMLElement, from: Node | null, to: Node | null, delta: number) {
  if (!delta) return;
  for (let n = from; n && n !== to; n = n.nextSibling) {
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const el = n as Element;
    for (const t of [el, ...Array.from(el.querySelectorAll('[aria-posinset]'))]) {
      if (!t.hasAttribute('aria-posinset')) continue;
      if (t.parentElement?.closest('.md') !== host) continue;
      const pos = parseInt(t.getAttribute('aria-posinset')!, 10);
      if (!isNaN(pos)) t.setAttribute('aria-posinset', '' + (pos + delta));
    }
  }
}

/**
 * Wrap a ViewContainerRef to track the components created through it.
 * @return the wrapped container and a function to destroy only the tracked views
 */
export function trackViews(vc: ViewContainerRef): { vc: ViewContainerRef, destroy: () => void } {
  const refs: ComponentRef<any>[] = [];
  const tracked = new Proxy(vc, {
    get(target, prop) {
      if (prop === 'createComponent') {
        return (...args: any[]) => {
          const c = (target.createComponent as any)(...args);
          refs.push(c);
          return c;
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return {
    vc: tracked,
    destroy() {
      for (const c of refs.splice(0)) {
        const index = vc.indexOf(c.hostView);
        if (index >= 0) {
          vc.remove(index);
        } else {
          c.destroy();
        }
      }
    },
  };
}

/**
 * Hydrated content in progressive markdown: the elements replaced or decorated by hydrators.
 * Each is bounded by a pair of comments so it can be kept, destroyed or hydrated on its own.
 */
export const MD_ISLANDS = 'pre, a[href], .md-embed, .inline-embed, .inline-ref, .toggle.inline, .toggle.embed';

export interface MdIsland {
  /** Identity of the unhydrated element, or empty if it must not be reused. */
  key: string;
  end: Comment;
  cleanup?: () => void;
}

/**
 * Islands keyed by their start comment.
 */
export type MdIslands = Map<Comment, MdIsland>;

/**
 * Key of an unhydrated island, ignoring source map positions.
 */
export function islandKey(el: Element) {
  const clone = el.cloneNode(true) as Element;
  clone.removeAttribute('aria-posinset');
  clone.querySelectorAll('[aria-posinset]').forEach(t => t.removeAttribute('aria-posinset'));
  return clone.outerHTML;
}

/**
 * Bound the outermost hydratable elements of a detached root with comments.
 */
export function markIslands(root: HTMLElement): MdIslands {
  const islands: MdIslands = new Map();
  root.querySelectorAll(MD_ISLANDS).forEach(el => {
    const outer = el.parentElement?.closest(MD_ISLANDS);
    if (outer && root.contains(outer)) return;
    const start = el.ownerDocument.createComment('md-island');
    const end = el.ownerDocument.createComment('/md-island');
    el.before(start);
    el.after(end);
    islands.set(start, { key: islandKey(el), end });
  });
  return islands;
}

/**
 * Remove the "toggle" link text in front of embed toggles.
 */
export function removeToggleLabels(doc: Document) {
  doc.body.querySelectorAll('.toggle.embed').forEach(t => {
    if (t.previousSibling?.textContent === 'toggle') t.previousSibling.remove();
  });
}

export interface MdMorph {
  /** Live markdown host (.md) */
  host: HTMLElement;
  /** Live islands, updated as islands are destroyed and hydrated */
  live: MdIslands;
  /** Unhydrated islands of the new tree */
  next: MdIslands;
  /** Hydrate a detached island in place */
  hydrate(start: Comment, island: MdIsland): void;
}

interface MdItem {
  first: Node;
  last: Node;
  island?: MdIsland;
}

function mdItems(first: Node | null, end: Node | null, islands: MdIslands): MdItem[] {
  const result: MdItem[] = [];
  for (let n = first; n && n !== end; n = n.nextSibling) {
    const island = n.nodeType === Node.COMMENT_NODE ? islands.get(n as Comment) : undefined;
    if (island) {
      result.push({ first: n, last: island.end, island });
      n = island.end;
    } else {
      result.push({ first: n, last: n });
    }
  }
  return result;
}

function sameItem(a: MdItem, b: MdItem) {
  if (a.island || b.island) return !!a.island?.key && a.island.key === b.island?.key;
  if (a.first.nodeType !== b.first.nodeType) return false;
  if (a.first.nodeType !== Node.ELEMENT_NODE) return true;
  const x = a.first as Element, y = b.first as Element;
  return x.localName === y.localName && x.namespaceURI === y.namespaceURI;
}

/**
 * Match old items to new items, keeping order. Common prefix and suffix
 * items are matched when compatible, the rest only when they are identical islands.
 */
function matchItems(old: MdItem[], next: MdItem[]): (MdItem | undefined)[] {
  const result: (MdItem | undefined)[] = new Array(next.length).fill(undefined);
  let start = 0;
  while (start < old.length && start < next.length && sameItem(old[start], next[start])) {
    result[start] = old[start];
    start++;
  }
  let oldEnd = old.length;
  let nextEnd = next.length;
  while (oldEnd > start && nextEnd > start && sameItem(old[oldEnd - 1], next[nextEnd - 1])) {
    result[--nextEnd] = old[--oldEnd];
  }
  let last = start;
  for (let i = start; i < nextEnd; i++) {
    if (!next[i].island) continue;
    for (let j = last; j < oldEnd; j++) {
      if (old[j].island && sameItem(old[j], next[i])) {
        result[i] = old[j];
        last = j + 1;
        break;
      }
    }
  }
  return result;
}

function itemNodes(item: MdItem) {
  const nodes: Node[] = [];
  for (let n: Node | null = item.first; n; n = n.nextSibling) {
    nodes.push(n);
    if (n === item.last) break;
  }
  return nodes;
}

function comments(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) return [node as Comment];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const result: Comment[] = [];
  const walker = node.ownerDocument!.createTreeWalker(node, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) result.push(walker.currentNode as Comment);
  return result;
}

/**
 * Destroy the live islands in a list of nodes.
 */
export function destroyIslands(nodes: Node[], islands: MdIslands) {
  for (const n of nodes) {
    for (const c of comments(n)) {
      const island = islands.get(c);
      if (!island) continue;
      islands.delete(c);
      island.cleanup?.();
    }
  }
}

function sourceMapped(nodes: Node[], host?: HTMLElement) {
  const result: Element[] = [];
  for (const n of nodes) {
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const el = n as Element;
    for (const t of [el, ...Array.from(el.querySelectorAll('[aria-posinset]'))]) {
      if (!t.hasAttribute('aria-posinset')) continue;
      if (host && t.parentElement?.closest('.md') !== host) continue;
      result.push(t);
    }
  }
  return result;
}

function syncAttributes(el: Element, from: Element) {
  for (const a of Array.from(el.attributes)) {
    if (!from.hasAttributeNS(a.namespaceURI, a.localName)) el.removeAttributeNS(a.namespaceURI, a.localName);
  }
  for (const a of Array.from(from.attributes)) {
    if (el.getAttributeNS(a.namespaceURI, a.localName) !== a.value) el.setAttributeNS(a.namespaceURI, a.name, a.value);
  }
}

/**
 * Update a range of live sibling nodes to match the children of a new, unhydrated tree.
 * Live nodes are only updated in place or removed, never moved, so iframes do not reload.
 * Islands with the same key are kept as is, new islands are hydrated before they are inserted.
 * @param parent live parent node
 * @param first first live node of the range
 * @param end live node after the range, or null for the end of the parent
 * @param from detached parent of the new nodes
 */
export function morphRange(parent: Node, first: Node | null, end: Node | null, from: Node, m: MdMorph) {
  const old = mdItems(first, end, m.live);
  const next = mdItems(from.firstChild, null, m.next);
  const matched = matchItems(old, next);
  const kept = new Set(matched);
  for (const o of old) {
    if (kept.has(o)) continue;
    const nodes = itemNodes(o);
    destroyIslands(nodes, m.live);
    for (const n of nodes) n.parentNode?.removeChild(n);
  }
  let ref = end;
  for (let i = next.length - 1; i >= 0; i--) {
    const n = next[i];
    const o = matched[i];
    if (!o) {
      for (const c of comments(n.first)) {
        const island = m.next.get(c);
        if (!island) continue;
        m.hydrate(c, island);
        m.live.set(c, island);
      }
      const nodes = itemNodes(n);
      for (let j = nodes.length - 1; j >= 0; j--) {
        parent.insertBefore(nodes[j], ref);
        ref = nodes[j];
      }
      continue;
    }
    if (o.island) {
      const was = sourceMapped(itemNodes(o), m.host);
      const pos = sourceMapped(itemNodes(n)).map(t => t.getAttribute('aria-posinset')!);
      if (was.length === pos.length) {
        was.forEach((t, j) => t.setAttribute('aria-posinset', pos[j]));
      } else if (was.length && pos.length) {
        const delta = parseInt(pos[0], 10) - parseInt(was[0].getAttribute('aria-posinset')!, 10);
        if (!isNaN(delta)) {
          for (const t of was) t.setAttribute('aria-posinset', '' + (parseInt(t.getAttribute('aria-posinset')!, 10) + delta));
        }
      }
    } else if (o.first.nodeType === Node.ELEMENT_NODE) {
      syncAttributes(o.first as Element, n.first as Element);
      morphRange(o.first, o.first.firstChild, null, n.first, m);
    } else if (o.first.nodeValue !== n.first.nodeValue) {
      o.first.nodeValue = n.first.nodeValue;
    }
    ref = o.first;
  }
}

/**
 * Pair changed blocks with removed blocks in the same position that share an island,
 * so they can be updated in place.
 * @param old previous blocks
 * @param matched for each new block, the identical old block if any
 * @param islands unhydrated islands of each unmatched new block
 * @return for each new block, the old block to update in place, if any
 */
export function pairBlocks<T extends { islands: MdIslands }>(
  old: T[],
  matched: (T | undefined)[],
  islands: (i: number) => MdIslands | undefined,
): (T | undefined)[] {
  const result: (T | undefined)[] = new Array(matched.length).fill(undefined);
  const index = new Map(old.map((b, i) => [b, i]));
  let i = 0;
  while (i < matched.length) {
    if (matched[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < matched.length && !matched[j]) j++;
    let lo = i > 0 ? index.get(matched[i - 1]!)! + 1 : 0;
    const hi = j < matched.length ? index.get(matched[j]!)! : old.length;
    for (let k = i; k < j; k++) {
      const keys = new Set(Array.from(islands(k)?.values() || [], v => v.key));
      for (let q = lo; q < hi; q++) {
        if (Array.from(old[q].islands.values()).some(v => v.key && keys.has(v.key))) {
          result[k] = old[q];
          lo = q + 1;
          break;
        }
      }
    }
    i = j;
  }
  return result;
}
