import { inject, Injectable, ViewContainerRef } from '@angular/core';
import { escape, uniq } from 'lodash-es';
import { marked, MarkedExtension, Renderer, RendererObject, Token, Tokens, TokensList } from 'marked';
import markedKatex from 'marked-katex-extension';
import { catchError, EMPTY, forkJoin, map, Observable, of, retry, Subscription, switchMap } from 'rxjs';
import { Ext } from '../model/ext';
import { Oembed } from '../model/oembed';
import { Page } from '../model/page';
import { Ref, RefSort } from '../model/ref';
import { wikiUriFormat } from '../mods/org/wiki';
import { OembedStore } from '../store/oembed';
import { Store } from '../store/store';
import { createEmbed, createLens, createLink, createRef, dataUrl, embedUrl, parseSrc, setIframeSrc } from '../util/embed';
import { getArray, parseBookmarkParams } from '../util/http';
import {
  assignSourceMap,
  attachMarkdown,
  clipboardHydrator,
  fixUserTags,
  MdBlock,
  MdContext,
  MdHydrator,
  MdIsland,
  MdIslands,
  markIslands,
  mediaToPlaceholders,
  mermaidHydrator,
  prismHydrator,
  removeToggleLabels,
  sanitizeMarkdown,
  trackViews,
  wrapTables
} from '../util/markdown';
import { getArgs, getFilters, UrlFilter } from '../util/query';
import { isQuery, queryPrefix, topAnds } from '../util/tag';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { ConfigService } from './config.service';
import { EditorService } from './editor.service';

/**
 * marked is a global singleton, so KaTeX is gated per parse instead of
 * being added and removed.
 */
let katexEnabled = false;

/**
 * A rendered block in a detached root with its islands marked.
 */
export interface MdRoot {
  root: HTMLElement;
  islands: MdIslands;
}

function gatedKatex(): MarkedExtension {
  const ext = markedKatex({ throwOnError: false });
  return {
    extensions: ext.extensions!.map((e: any) => ({
      ...e,
      start: e.start && function (this: any, src: string) {
        return katexEnabled ? e.start.call(this, src) : undefined;
      },
      tokenizer(this: any, src: string, tokens: any) {
        return katexEnabled ? e.tokenizer.call(this, src, tokens) : undefined;
      },
    })),
  };
}

@Injectable({
  providedIn: 'root'
})
export class EmbedService {
  private config = inject(ConfigService);
  private admin = inject(AdminService);
  private editor = inject(EditorService);
  private refs = inject(RefService);
  private exts = inject(ExtService);
  private oembeds = inject(OembedStore);
  private store = inject(Store);

  /**
   * Ordered registry of hydrators run on rendered markdown after it is attached.
   */
  readonly hydrators: MdHydrator[] = [
    mermaidHydrator,
    prismHydrator,
    clipboardHydrator,
    (host, ctx) => this.hydrateToggles(host, ctx),
    (host, ctx) => this.hydrateLinks(host, ctx),
    (host, ctx) => this.hydrateEmbeds(host, ctx),
    (host, ctx) => this.hydrateInlineRefs(host, ctx),
    (host, ctx) => this.hydrateInlineEmbeds(host, ctx),
  ];

  constructor() {
    const config = this.config;
    const admin = this.admin;
    const editor = this.editor;
    function cleanUrl(href: string) {
      try {
        href = encodeURI(href).replace(/%25/g, '%');
      } catch {
        return null;
      }
      return href;
    }
    function sourceMap<T extends keyof Renderer>(name: T) {
      const orig = Renderer.prototype[name] as any;
      return function (this: any, token: any, ...rest: any[]) {
        const html = orig.call(this, token, ...rest);
        return html.replace(/^(<\w+)/, `$1 aria-posinset="${token.sourceMap}"`);
      };
    }
    marked.use({
      gfm: true,
      breaks: false,
      pedantic: false,
      hooks: {
        processAllTokens(tokens: Token[] | TokensList) {
          return assignSourceMap(tokens);
        },
      },
      renderer: {
        paragraph : sourceMap('paragraph'),
        heading   : sourceMap('heading'),
        list      : sourceMap('list'),
        listitem  : sourceMap('listitem'),
        code      : sourceMap('code'),
        blockquote: sourceMap('blockquote'),
        table     : sourceMap('table'),
        tablerow  : sourceMap('tablerow'),
        image({href, title, text}: Tokens.Image): string {
          const cleanHref = cleanUrl(href);
          if (cleanHref === null) {
            return escape(text);
          }
          href = cleanHref;
          if (href.startsWith(config.base) || !href.startsWith('http')) {
            return `<div class="loading inline-embed" title="${text}">${href}</div>`;
          }
          let out = `<img src="${href}" alt="${text}"`;
          if (title) {
            out += ` title="${escape(title)}"`;
          }
          out += '>';
          return out;
        },
        link({href, title, tokens}: Tokens.Link): string {
          const text = this.parser.parseInline(tokens);
          if (tokens.find(t => t.type === 'bang-embed' || t.type === 'image')) {
            // Skip linking images
            return text;
          }
          const cleanHref = cleanUrl(href);
          if (cleanHref === null) {
            return text;
          }
          href = cleanHref;
          let out = '<a href="' + href + '"';
          if (title) {
            out += ' title="' + (escape(title)) + '"';
          }
          out += '>' + text + '</a>';
          if (admin.getPluginsForUrl(href).length || ['ref', 'tag'].includes(editor.getUrlType(href))) {
            return out + `<span class="toggle embed" title="${href}"><span class="toggle-plus">＋</span></span>`;
          }
          return out;
        }
      } as RendererObject,
      extensions: this.extensions,
    });
    marked.use(gatedKatex());
  }

  /**
   * Parse markdown into an HTML string.
   */
  parse(markdown: string, katex = false): string {
    katexEnabled = katex;
    try {
      return marked.parse(markdown || '', { async: false });
    } catch (e: any) {
      console.error(e);
      return `<p class="error">${escape(e.message)}</p>`;
    } finally {
      katexEnabled = false;
    }
  }

  /**
   * Render markdown into an inert document. Nothing in the returned document
   * will load any resources: media is replaced by placeholders.
   * @param markdown text to render
   * @param origin origin to append to user links without existing origins
   * @param katex render LaTeX
   * @param disableSanitizer skip DOMPurify
   */
  renderDocument(markdown: string, origin = '', katex = false, disableSanitizer = false): Document {
    return this.toDocument(this.parse(markdown, katex), origin, disableSanitizer);
  }

  /**
   * Lex markdown into top-level tokens with absolute source maps.
   */
  lex(markdown: string, katex = false): TokensList {
    katexEnabled = katex;
    try {
      return assignSourceMap(marked.lexer(markdown || ''));
    } finally {
      katexEnabled = false;
    }
  }

  /**
   * Render a single block of tokens into an inert document.
   * @param block block from {@link mdBlocks}
   * @param links reference link definitions from the full token list
   * @param origin origin to append to user links without existing origins
   * @param disableSanitizer skip DOMPurify
   */
  renderBlockDocument(block: MdBlock, links: TokensList['links'], origin = '', disableSanitizer = false): Document {
    let html: string;
    try {
      html = marked.parser(Object.assign([...block.tokens], { links }) as TokensList);
    } catch (e: any) {
      console.error(e);
      html = `<p class="error">${escape(e.message)}</p>`;
    }
    return this.toDocument(html, origin, disableSanitizer);
  }

  /**
   * Render a single block into a detached root with its islands marked, but not hydrated.
   */
  renderBlock(block: MdBlock, links: TokensList['links'], origin = '', disableSanitizer = false): MdRoot {
    const doc = this.renderBlockDocument(block, links, origin, disableSanitizer);
    const root = document.createElement('div');
    root.append(...Array.from(document.adoptNode(doc.body).childNodes));
    return { root, islands: markIslands(root) };
  }

  /**
   * Hydrate a single detached island in place. Sets the island cleanup,
   * which also destroys only the components created for this island.
   */
  hydrateIsland(start: Comment, island: MdIsland, ctx: MdContext) {
    const parent = start.parentNode!;
    const wrapper = start.ownerDocument.createElement('div');
    while (start.nextSibling && start.nextSibling !== island.end) wrapper.appendChild(start.nextSibling);
    parent.insertBefore(wrapper, island.end);
    const views = trackViews(ctx.vc);
    const cleanup = this.hydrate(wrapper, { ...ctx, vc: views.vc });
    wrapper.replaceWith(...Array.from(wrapper.childNodes));
    island.cleanup = () => {
      cleanup();
      views.destroy();
    };
  }

  private toDocument(html: string, origin = '', disableSanitizer = false): Document {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!disableSanitizer) sanitizeMarkdown(doc);
    mediaToPlaceholders(doc);
    wrapTables(doc);
    removeToggleLabels(doc);
    fixUserTags(doc, origin, this.store.origins.originMap().get(origin || ''));
    return doc;
  }

  /**
   * Render markdown, attach it to the live host and hydrate it.
   * @return cleanup function
   */
  render(host: HTMLElement, markdown: string, ctx: MdContext, katex = false, disableSanitizer = false): () => void {
    attachMarkdown(host, this.renderDocument(markdown, ctx.origin, katex, disableSanitizer));
    return this.hydrate(host, ctx);
  }

  /**
   * Run all hydrators on attached markdown.
   * @return cleanup function
   */
  hydrate(host: HTMLElement, ctx: MdContext): () => void {
    const cleanup: (() => void)[] = [];
    for (const h of this.hydrators) {
      try {
        const fn = h(host, ctx);
        if (fn) cleanup.push(fn);
      } catch (e) {
        console.error(e);
      }
    }
    return () => cleanup.forEach(fn => fn());
  }

  private get extensions() {
    const self = this;
    return [{
      name: 'userTag',
      level: 'inline',
      start: (src: string) => src.match(/[+_]/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^([+_](user|plugin)\/[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?)/;
        const match = rule.exec(src);
        if (match) {
          const text = match[0]
          const title = $localize`User ` + text;
          return {
            type: 'userTag',
            href: '/tag/' + text,
            text,
            title,
            raw: text,
            tokens: [],
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a class="user tag" href="${token.href}" title="${token.title}">${token.text}</a>`;
      }
    }, {
      name: 'hashTag',
      level: 'inline',
      start: (src: string) => src.match(/#/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^#([+_]?[a-z0-9]+([./][a-z0-9]+)*)(\?[^\s)#]*)?/;
        const match = rule.exec(src);
        if (match) {
          const tag = '#' + match[1];
          // Don't link simple numbers
          if (/^#[0-9]+$/.exec(tag)) return undefined;
          const qs = match[3] || '';
          return {
            type: 'hashTag',
            href: '/tag/' + match[1] + qs,
            text: tag,
            title: tag,
            raw: match[0],
            tokens: [],
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a class="tag" href="${token.href}" title="${token.title}">${token.text}</a>`;
      }
    }, {
      name: 'wiki',
      level: 'inline',
      start: (src: string) => src.match(/\[\[[a-zA-Z]/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^\[\[([^\]]+)]]/;
        const match = rule.exec(src);
        if (match) {
          // Don't match on source or alt refs
          if (/^(alt)?\d+$/.test(match[1])) return undefined;
          const text = match[1];
          const href = (self.admin.isWikiExternal() ? '' : '/ref/') + wikiUriFormat(text, self.admin.getWikiPrefix());
          return {
            type: 'wiki',
            href,
            text,
            raw: match[0],
            tokens: [],
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        if (self.admin.isWikiExternal()) {
          return `<a target="_blank" href="${token.href}">${token.text}</a>`;
        } else {
          return `<a class="wiki ref" href="${token.href}">${token.text}</a>`;
        }
      }
    }, {
      name: 'wiki-embed',
      level: 'inline',
      start: (src: string) => src.match(/\[!\[[a-zA-Z]/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^!\[\[([^\]]+)]]/;
        const match = rule.exec(src);
        if (match) {
          const text = match[1];
          const href = (self.admin.isWikiExternal() ? '' : '/ref/') + wikiUriFormat(text, self.admin.getWikiPrefix());
          return {
            type: 'wiki-embed',
            href,
            text,
            raw: match[0],
            tokens: [],
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        if (self.admin.isWikiExternal()) {
          return `<a target="_blank" href="${token.href}">${token.text}</a>`;
        } else {
          return `<div class="loading inline-embed">${token.href}</div>`;
        }
      }
    }, {
      name: 'bang-embed',
      level: 'inline',
      start: (src: string) => src.match(/!\[]\(/)?.index,
      tokenizer(src: string, tokens: any): any {
        // @ts-ignore
        const match = src.startsWith('!') && this.lexer.tokenizer.rules.inline.link.exec(src);
        if (match) {
          return {
            // @ts-ignore
            ...this.lexer.tokenizer.link(src),
            type: 'bang-embed',
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        if (token.text?.trim() === '=') {
          return `<div class="loading inline-ref" title="${token.title}">${token.href}</div>`;
        } else if (token.text?.trim() === '+') {
          return `<span class="toggle embed" title="${token.href}"><span class="toggle-plus">＋</span></span>`;
        } else {
          return `<div class="loading inline-embed" title="${token.title}">${token.href}</div>`;
        }
      }
    }, {
      name: 'preserveMath',
      level: 'inline',
      start: (src: string) => src.match(/\$/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^(\$\$[^$]+\$\$|\$[^$]+\$)/;
        let match = rule.exec(src);
        if (match) {
          return {
            type: 'preserveMath',
            raw: match[0],
            tokens: [],
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return token.raw;
      }
    }, {
      name: 'superscript',
      level: 'inline',
      start: (src: string) => src.match(/\^/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^\^(\S+)/;
        const match = rule.exec(src);
        if (match) {
          const text = match[1];
          return {
            type: 'superscript',
            text,
            raw: match[0],
            // @ts-ignore
            tokens: this.lexer.inlineTokens(text, []),
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        // @ts-ignore
        return `<sup>${this.parser.parseInline(token.tokens)}</sup>`;
      }
    }];
  }

  private insert(t: Node, el: Node, after = false) {
    t.parentNode?.insertBefore(el, after ? t.nextSibling : t);
  }

  /**
   * Replace <span class="md-embed"> media placeholders with embeds.
   */
  private hydrateEmbeds(host: HTMLElement, { vc, origin }: MdContext) {
    const imagesEnabled = !!this.admin.getPlugin('plugin/image');
    host.querySelectorAll<HTMLElement>('.md-embed').forEach(t => {
      const { url, plugin, title, alt, width, height } = t.dataset;
      if (!url || !plugin) {
        t.remove();
        return;
      }
      if (plugin === 'plugin/image' && !imagesEnabled) {
        const c = createLink(vc, url, alt || title || url, title);
        this.insert(t, c.location.nativeElement);
      } else {
        const ref: Ref = { url, origin, tags: [plugin] };
        if (plugin === 'plugin/image' || plugin === 'plugin/video') {
          const config = {} as any;
          if (width) config.width = width;
          if (height) config.height = height;
          ref.plugins = { [plugin]: config };
        }
        const c = createEmbed(vc, ref);
        if (title) c.location.nativeElement.title = title;
        if (alt) c.location.nativeElement.alt = alt;
        this.insert(t, c.location.nativeElement);
      }
      t.remove();
    });
  }

  private hydrateInlineRefs(host: HTMLElement, { vc }: MdContext) {
    const subscriptions: Subscription[] = [];
    host.querySelectorAll<HTMLElement>('.inline-ref').forEach(t => {
      const url = t.textContent || '';
      subscriptions.push(this.refs.getCurrent(this.editor.getRefUrl(url)).pipe(
        retry(1),
        catchError(() => of(null)),
      ).subscribe(ref => {
        if (ref) {
          const c = createRef(vc, ref, true);
          this.insert(t, c.location.nativeElement);
        } else {
          this.insert(t, this.warning(`Ref ${url} not found.`));
        }
        t.remove();
      }));
    });
    return () => subscriptions.forEach(s => s.unsubscribe());
  }

  private hydrateInlineEmbeds(host: HTMLElement, { vc, origin }: MdContext) {
    const subscriptions: Subscription[] = [];
    host.querySelectorAll<HTMLElement>('.inline-embed').forEach(t => {
      const url = t.textContent || '';
      const title = t.title;
      const type = this.editor.getUrlType(url);
      if (type === 'tag') {
        subscriptions.push(this.loadQuery$(url).subscribe(({params, page, ext}) => {
          const c = createLens(vc, params, page, this.editor.getQuery(url), ext);
          if (title) c.location.nativeElement.title = title;
          this.insert(t, c.location.nativeElement);
          t.remove();
        }));
      } else {
        subscriptions.push(this.refs.getCurrent(this.editor.getRefUrl(url)).pipe(
          retry(1),
          catchError(() => of(null)),
          switchMap(ref => {
            const expandPlugins = this.admin.getEmbeds(ref);
            if (ref?.comment || expandPlugins.length) {
              const c = createEmbed(vc, { ...ref!, tags: expandPlugins });
              if (title) c.location.nativeElement.title = title;
              this.insert(t, c.location.nativeElement);
              t.remove();
            } else {
              const embeds = this.admin.getPluginsForUrl(url);
              if (embeds.length) {
                const c = createEmbed(vc, { url, origin, tags: embeds.map(p => p.tag) });
                if (title) c.location.nativeElement.title = title;
                this.insert(t, c.location.nativeElement);
                t.remove();
              } else if (url.startsWith('/ref/')) {
                this.insert(t, this.warning(`Ref ${url} not found and could not embed directly.`));
                t.remove();
              } else {
                return this.oembeds.get(url, this.store.darkTheme() ? 'dark' : undefined).pipe(
                  catchError(() => of(null)),
                  map(oembed => {
                    if (!oembed && !this.admin.getPlugin('plugin/image')) {
                      const c = createLink(vc, url, title || url, title);
                      this.insert(t, c.location.nativeElement);
                      t.remove();
                      return;
                    }
                    const expandPlugins = oembed ? ['plugin/embed'] : ['plugin/image'];
                    const c = createEmbed(vc, { url, origin, tags: expandPlugins });
                    c.location.nativeElement.title = title;
                    this.insert(t, c.location.nativeElement);
                    t.remove();
                  }),
                );
              }
            }
            return of(null);
          }),
        ).subscribe());
      }
    });
    return () => subscriptions.forEach(s => s.unsubscribe());
  }

  /**
   * Wire up a toggle button with plus and x faces.
   * @param t toggle element
   * @param expand called to expand, must call done with the inserted element
   * @return cleanup function
   */
  private toggle(t: HTMLElement, expand: (done: (el?: Node) => void) => Subscription | void) {
    t.innerHTML = '<span class="toggle-plus">＋</span><span class="toggle-x" style="display: none">✕</span>';
    const plus = t.querySelector<HTMLElement>('.toggle-plus')!;
    const x = t.querySelector<HTMLElement>('.toggle-x')!;
    let expanded: Node | undefined;
    let pending = false;
    let loading: Subscription | void;
    const collapse = () => {
      plus.style.display = 'block';
      x.style.display = 'none';
    };
    const onClick = () => {
      if (pending) return;
      if (expanded) {
        expanded.parentNode?.removeChild(expanded);
        expanded = undefined;
        collapse();
      } else {
        plus.style.display = 'none';
        x.style.display = 'block';
        pending = true;
        loading = expand(el => {
          pending = false;
          if (!el) {
            collapse();
            return;
          }
          expanded = el;
          this.insert(t, el, true);
        });
        // Recover if the subscription errors or completes without an element
        loading?.add(() => {
          if (!pending) return;
          pending = false;
          collapse();
        });
        if (!pending) loading = undefined;
      }
    };
    t.addEventListener('click', onClick);
    return () => {
      t.removeEventListener('click', onClick);
      loading?.unsubscribe();
    };
  }

  private refOrWarning$(url: string, vc: ViewContainerRef, embed: boolean) {
    return this.refs.getCurrent(this.editor.getRefUrl(url)).pipe(
      retry(1),
      catchError(() => of(null)),
      map(ref => {
        if (!ref) {
          return this.warning(embed
            ? `Ref ${url} not found and could not embed directly.`
            : `Ref ${url} not found.`);
        }
        if (!embed) return createRef(vc, ref, true).location.nativeElement as Node;
        const expandPlugins = this.admin.getEmbeds(ref);
        if (ref.comment || expandPlugins.length) {
          return createEmbed(vc, { ...ref, tags: expandPlugins }).location.nativeElement as Node;
        }
        return this.warning(`Ref ${ref.title || ref.url} does not contain any embeds.`);
      }),
    );
  }

  private warning(message: string) {
    const warn = document.createElement('div');
    const span = document.createElement('span');
    span.className = 'error';
    span.textContent = message;
    warn.appendChild(span);
    return warn;
  }

  private hydrateToggles(host: HTMLElement, { vc, origin }: MdContext) {
    const cleanup: (() => void)[] = [];
    host.querySelectorAll<HTMLElement>('.toggle.inline').forEach(t => {
      // TODO: Don't use title to store url
      const url = t.title;
      cleanup.push(this.toggle(t, done => {
        const type = this.editor.getUrlType(url);
        if (type === 'ref') {
          return this.refOrWarning$(url, vc, false).subscribe(el => done(el));
        } else if (type === 'tag') {
          return this.loadQuery$(url).pipe(
            catchError(err => {
              console.error(err);
              return EMPTY;
            }),
          ).subscribe(({params, page, ext}) =>
            done(createLens(vc, params, page, this.editor.getQuery(url), ext).location.nativeElement));
        }
        return done();
      }));
    });
    host.querySelectorAll<HTMLElement>('.toggle.embed').forEach(t => {
      // TODO: Don't use title to store url
      const url = t.title;
      cleanup.push(this.toggle(t, done => {
        const embeds = this.admin.getPluginsForUrl(url);
        if (embeds.length) {
          return done(createEmbed(vc, { url, origin, tags: embeds.map(p => p.tag) }).location.nativeElement);
        }
        if (this.editor.getUrlType(url) === 'tag') {
          return this.loadQuery$(url).pipe(
            catchError(err => {
              console.error(err);
              return EMPTY;
            }),
          ).subscribe(({params, page, ext}) =>
            done(createLens(vc, params, page, this.editor.getQuery(url), ext).location.nativeElement));
        }
        return this.refOrWarning$(url, vc, true).subscribe(el => done(el));
      }));
    });
    return () => cleanup.forEach(fn => fn());
  }

  private hydrateLinks(host: HTMLElement, { vc }: MdContext) {
    const imagesEnabled = !!this.admin.getPlugin('plugin/image');
    host.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(t => {
      const href = t.getAttribute('href') || '';
      const embeds = t.querySelectorAll<HTMLElement>('.md-embed');
      if (embeds.length) {
        if (imagesEnabled || Array.from(embeds).some(e => e.dataset.plugin !== 'plugin/image')) {
          // Don't allow linking images
          t.replaceWith(...Array.from(t.childNodes));
          return;
        }
        const e = embeds[0].dataset;
        const c = createLink(vc, href, t.textContent?.trim() || e.alt || e.title || href, t.title, t.className);
        this.insert(t, c.location.nativeElement);
        t.remove();
        return;
      }
      const c = createLink(vc, href, t.textContent || '', t.title, t.className);
      this.insert(t, c.location.nativeElement);
      t.remove();
    });
  }

  private get iframeBg() {
    return getComputedStyle(document.body).backgroundColor;
  }

  async writeIframe(oembed: Oembed, iframe: HTMLIFrameElement, width = '100px', scroll = true) {
    if (!iframe.style.width) iframe.style.width = (oembed.width ? oembed.width + 'px' : width);
    if (!iframe.style.height && oembed.height) iframe.style.height = oembed.height + 'px';
    const html = oembed.html && !oembed.html.startsWith('<iframe');
    if (oembed.html) {
      if (oembed.html.startsWith('<iframe')) {
        setIframeSrc(iframe, embedUrl(parseSrc(oembed.html)));
      } else {
        this.writeIframeHtml(oembed.html || '', iframe, scroll);
      }
    } else {
      setIframeSrc(iframe, embedUrl(oembed.url));
    }
    if (!iframe.style.height && !oembed.height) {
      iframe.style.height = (oembed.width ? oembed.width + 'px' : width);
      if (html) await followHeight(iframe);
    }
  }

  writeIframeHtml(html: string, iframe: HTMLIFrameElement, scroll = true) {
    setIframeSrc(iframe, dataUrl(transparentIframe(html, this.iframeBg, scroll ? 'auto' : 'hidden')));
  }

  loadQuery$(url: string):  Observable<{params: any, page: Page<Ref>, ext?: Ext}> {
    const query = this.editor.getQuery(url);
    const params = parseBookmarkParams(url);
    const view: string = params.view;
    return forkJoin({
      params: of(params),
      page: this.refs.page(getArgs(query, getArray(params.sort) as RefSort[], getArray(params.filter) as UrlFilter[], params.search, params.pageNumber, params.pageSize)),
      ext: this.exts.getCachedExts(uniq([
        ...topAnds(query),
        ...topAnds(query).map(queryPrefix),
        ...getFilters(params.filter),
      ].filter(t => t && !isQuery(t)))).pipe(
        map(exts => this.getExt(view, exts))
      ),
    });
  }

  private getExt(view: string, exts: Ext[]) {
    if (view === 'list') return undefined;
    if (!view) {
      view = exts[0]?.tag;
    }
    const ext = exts.find(x => x.modifiedString && x.tag === view);
    if (ext) return ext;
    const t = this.admin.view().find(t => t.tag === view);
    if (t) {
      return { tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, view: t.config?.view } };
    }
    return undefined;
  }
}

/**
 * Resize the iframe to the height reported by {@link transparentIframe}.
 * Resolves once the content is at least 300px high, or has not changed for 5 seconds.
 * Keeps following the height until it has not changed for 30 seconds.
 */
function followHeight(iframe: HTMLIFrameElement) {
  return new Promise<void>(resolve => {
    let settled = setTimeout(resolve, 5_000);
    let stop = setTimeout(() => removeEventListener('message', listener), 30_000);
    const listener = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const h = event.data?.jasperIframeHeight;
      if (typeof h !== 'number' || !Number.isFinite(h) || h <= 0) return;
      clearTimeout(stop);
      stop = setTimeout(() => removeEventListener('message', listener), 30_000);
      if (document.fullscreenElement) return;
      iframe.style.height = h + 'px';
      clearTimeout(settled);
      if (h >= 300) {
        resolve();
      } else {
        settled = setTimeout(resolve, 5_000);
      }
    };
    addEventListener('message', listener);
  });
}

export function transparentIframe(content: string, bgColor: string, overflow = 'auto') {
  return `
  <html>
  <head>
    <style>
    html, body {
      height: 100%;
      background-color: ${bgColor};
      overflow: ${overflow};
      margin: 0;
    }
    body > * {
      margin-left: auto;
      margin-right: auto;
    }
    </style>
  </head>
    <body>${content}<script>
      (() => {
        // The opaque origin of a data: URL cannot be read by the app, so report the height
        let height = 0;
        // body.scrollHeight never drops below the iframe height, so measure the content to let it shrink
        const measure = () => {
          let bottom = 0;
          for (const el of document.body.children) {
            if (el.tagName === 'SCRIPT') continue;
            bottom = Math.max(bottom, el.getBoundingClientRect().bottom + parseFloat(getComputedStyle(el).marginBottom) + scrollY);
          }
          return Math.ceil(bottom) || document.body.scrollHeight;
        };
        const report = () => {
          const h = measure();
          if (h === height) return;
          height = h;
          parent.postMessage({ jasperIframeHeight: height }, ${JSON.stringify(location.origin)});
        };
        report();
        const timer = setInterval(report, 100);
        setTimeout(() => clearInterval(timer), 30_000);
      })();
    </script></body>
  </html>
  `;
}
