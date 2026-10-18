import { ViewContainerRef } from '@angular/core';
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
    if (url) result.push({ url, descriptor });
  }
  return result;
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
 * Sanitize an inert parsed markdown document in place.
 */
export function sanitizeMarkdown(doc: Document) {
  DOMPurify.sanitize(doc.body, { IN_PLACE: true });
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
  doc.body.querySelectorAll<HTMLIFrameElement>('iframe').forEach(t => {
    placeholder(doc, t, 'plugin/embed', mediaUrl(t, base));
  });
  doc.body.querySelectorAll('source, track').forEach(t => t.remove());
}

/**
 * Add origins to user tag links.
 * @param doc inert parsed markdown document
 * @param origin origin to append to user links without existing origins
 * @param lookup origin map for the given origin
 */
export function fixUserTags(doc: Document, origin = '', lookup?: Map<string, string>) {
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
  const wrapper = pre.parentElement;
  if (wrapper?.classList.contains('md-pre')) {
    return wrapper.querySelector<HTMLElement>(':scope > .markdown-clipboard-toolbar')!;
  }
  const div = pre.ownerDocument.createElement('div');
  div.className = 'md-pre';
  pre.replaceWith(div);
  div.appendChild(pre);
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
 * Remove common leading indentation.
 */
export function trimIndentation(markdown?: string) {
  if (!markdown) return '';
  let indentStart: number | undefined;
  return markdown
    .split('\n')
    .map(line => {
      let lineIndentStart = indentStart;
      if (line.length > 0) {
        lineIndentStart = lineIndentStart === undefined
          ? line.search(/\S|$/)
          : Math.min(line.search(/\S|$/), lineIndentStart);
      }
      if (indentStart === undefined) {
        indentStart = lineIndentStart;
      }
      return lineIndentStart ? line.substring(lineIndentStart) : line;
    })
    .join('\n');
}
