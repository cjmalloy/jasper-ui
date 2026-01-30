import { Injectable, ViewContainerRef } from '@angular/core';
import { escape, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { marked, Token, Tokens, TokensList } from 'marked';
import { MarkdownService, MarkedRenderer } from 'ngx-markdown';
import { catchError, forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { Ext } from '../model/ext';
import { Oembed } from '../model/oembed';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { wikiUriFormat } from '../mods/org/wiki';
import { OembedStore } from '../store/oembed';
import { Store } from '../store/store';
import { delay } from '../util/async';
import { createEmbed, createLens, createLink, createRef, embedUrl, parseSrc } from '../util/embed';
import { parseParams } from '../util/http';
import { getFilters, getFiltersQuery, parseArgs } from '../util/query';
import { hasPrefix, isQuery, localTag, queryPrefix, tagOrigin, topAnds } from '../util/tag';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { ConfigService } from './config.service';
import { EditorService } from './editor.service';

@Injectable({
  providedIn: 'root'
})
export class EmbedService {

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private markdownService: MarkdownService,
    private oembeds: OembedStore,
    private store: Store,
  ) {
    markdownService.options = {
      gfm: true,
      breaks: false,
      pedantic: false,
    };
    function cleanUrl(href: string) {
      try {
        href = encodeURI(href).replace(/%25/g, '%');
      } catch {
        return null;
      }
      return href;
    }
    function sourceMap<T extends keyof MarkedRenderer>(name: T) {
      const orig = marked.Renderer.prototype[name] as any;
      return function (this: any, token: any, ...rest: any[]) {
        const html = orig.call(this, token, ...rest);
        return html.replace(/^(<\w+)/, `$1 aria-posinset="${token.sourceMap}"`);
      };
    }
    marked.use({
      hooks: {
        processAllTokens(tokens: Token[] | TokensList) {
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
        },
        postprocess(html: string): string {
          const parser = new DOMParser();
          const htmlDoc = parser.parseFromString(html, 'text/html');
          const media = htmlDoc.querySelectorAll<HTMLImageElement|HTMLSourceElement>('img, source');
          media.forEach(t => {
            if (t.src) {
              t.src = 'unsafe:' + t.src;
            }
            if (t.srcset) {
              t.srcset = t.srcset.split(', ').map(src => 'unsafe:' + src).join(', ');
            }
          });
          return htmlDoc.body.innerHTML;
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
        html({text}: Tokens.HTML | Tokens.Tag): string {
          return text.replace(/<img/g, '<img loading="lazy"');
        },
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
      },
      extensions: this.extensions,
    });
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
        const rule = /^#([+_]?[a-z0-9]+([./][a-z0-9]+)*)/;
        const match = rule.exec(src);
        if (match) {
          const text = match[0];
          // Don't link simple numbers
          if (/^#[0-9]+$/.exec(text)) return undefined;
          return {
            type: 'hashTag',
            href: '/tag/' + match[1],
            text,
            title: text,
            raw: text,
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

  /**
   * Post process a markdown render.
   * @param vc
   * @param event callback to add event handlers without memory leaks
   * @param origin origin to append to user links without existing origins
   */
  postProcess(vc: ViewContainerRef, event: (type: string, el: Element, fn: () => void) => void, origin = '') {
    const el = vc.element.nativeElement as HTMLDivElement;
    const subscriptions: Subscription[] = [];
    const lookup = this.store.origins.originMap.get(origin || '');
    const userTags = el.querySelectorAll<HTMLAnchorElement>('.user.tag');
    userTags.forEach(t => {
      const userOrigin = tagOrigin(t.innerText);
      if (userOrigin) {
        if (lookup?.has(userOrigin)) {
          const tag = localTag(t.innerText) + lookup?.get(userOrigin);
          t.innerText = tag;
          t.href = '/tag/' + escape(tag);
          t.title = $localize`User ` + tag;
        }
      } else if (origin) {
        t.href = t.getAttribute('href') + origin;
      }
    });
    const pictures = el.querySelectorAll<HTMLPictureElement>('picture');
    pictures.forEach(t => {
      const source = t.querySelectorAll('source')[0];
      if (source.src || source.srcset) {
        const srcsets = source.srcset ? source.srcset.split(', ') : [source.src];
        let url = source.srcset ? srcsets[srcsets.length - 1].trim().split(' ')[0] : source.src;
        if (url.startsWith('unsafe:')) url = url.substring('unsafe:'.length);
        const config = {} as any;
        if (t.style.width) config.width = t.style.width;
        if (t.style.height) config.height = t.style.height;
        const c = createEmbed(vc, { url, origin, tags: ['plugin/image'], plugins: { 'plugin/image': config } });
        c.location.nativeElement.title = t.title;
        c.location.nativeElement.alt = t.querySelectorAll('img')[0]?.alt;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
      }
      t.remove();
    });
    const images = el.querySelectorAll<HTMLImageElement>('img');
    images.forEach(t => {
      if (t.src || t.srcset) {
        const srcsets = t.srcset ? t.srcset.split(', ') : [t.src];
        let url = t.srcset ? srcsets[srcsets.length - 1].trim().split(' ')[0] : t.src;
        if (url.startsWith('unsafe:')) url = url.substring('unsafe:'.length);
        const config = {} as any;
        if (t.style.width) config.width = t.style.width;
        if (t.style.height) config.height = t.style.height;
        const c = createEmbed(vc, { url, origin, tags: ['plugin/image'], plugins: { 'plugin/image': config } });
        c.location.nativeElement.title = t.title;
        c.location.nativeElement.alt = t.alt;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
      }
      t.remove();
    });
    const audio = el.querySelectorAll<HTMLAudioElement>('audio');
    audio.forEach(t => {
      const source = t.querySelectorAll('source')[0];
      if (source) {
        let url = source.src;
        if (url.startsWith('unsafe:')) url = url.substring('unsafe:'.length);
        const c = createEmbed(vc, { url, origin, tags: ['plugin/audio'] });
        c.location.nativeElement.title = t.title;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
      }
      t.remove();
    });
    const videos = el.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach(t => {
      const source = t.querySelectorAll('source')[0];
      if (source) {
        let url = source.src;
        if (url.startsWith('unsafe:')) url = url.substring('unsafe:'.length);
        const config = {} as any;
        if (t.style.width) config.width = t.style.width;
        if (t.style.height) config.height = t.style.height;
        const c = createEmbed(vc, { url, origin, tags: ['plugin/video'], plugins: { 'plugin/video': config } });
        c.location.nativeElement.title = t.title;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
      }
      t.remove();
    });
    const inlineRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-ref');
    inlineRefs.forEach(t => {
      const url = t.innerText;
      subscriptions.push(this.refs.getCurrent(this.editor.getRefUrl(url)).pipe(
        catchError(() => of(null)),
      ).subscribe(ref => {
        if (ref) {
          const c = createRef(vc, ref, true);
          t.parentNode?.insertBefore(c.location.nativeElement, t);
        } else {
          const warn = document.createElement('div');
          warn.innerHTML = `<span class="error">Ref ${escape(url)} not found.</span>`;
          t.parentNode?.insertBefore(warn, t);
        }
        t.remove();
      }));
    });
    const embedRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-embed');
    embedRefs.forEach(t => {
      const url = t.innerText;
      const title = t.title;
      const type = this.editor.getUrlType(url);
      if (type === 'tag') {
        subscriptions.push(this.loadQuery$(t.innerText).subscribe(({params, page, ext}) => {
          const c = createLens(vc, params, page, this.editor.getQuery(t.innerText), ext);
          if (title) c.location.nativeElement.title = title;
          t.parentNode?.insertBefore(c.location.nativeElement, t);
          t.remove();
        }));
      } else {
        subscriptions.push(this.refs.getCurrent(this.editor.getRefUrl(url)).pipe(
          catchError(() => of(null)),
          switchMap(ref => {
            const expandPlugins = this.admin.getEmbeds(ref);
            if (ref?.comment || expandPlugins.length) {
              const c = createEmbed(vc, { ...ref!, tags: expandPlugins });
              if (title) c.location.nativeElement.title = title;
              t.parentNode?.insertBefore(c.location.nativeElement, t);
              t.remove();
            } else {
              const embeds = this.admin.getPluginsForUrl(url);
              if (embeds.length) {
                const c = createEmbed(vc, { url, origin, tags: embeds.map(p => p.tag) });
                if (title) c.location.nativeElement.title = title;
                t.parentNode?.insertBefore(c.location.nativeElement, t);
                t.remove();
              } else if (url.startsWith('/ref/')) {
                const warn = document.createElement('div');
                warn.innerHTML = `<span class="error">Ref ${escape(url)} not found and could not embed directly.</span>`;
                t.parentNode?.insertBefore(warn, t);
                t.remove();
              } else {
                return this.oembeds.get(url, this.store.darkTheme ? 'dark' : undefined).pipe(
                  catchError(() => of(null)),
                  map(oembed => {
                    const expandPlugins = oembed ? ['plugin/embed'] : ['plugin/image'];
                    const c = createEmbed(vc, { url, origin, tags: expandPlugins });
                    c.location.nativeElement.title = t.title;
                    t.parentNode?.insertBefore(c.location.nativeElement, t);
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
    const toggleFaces = '<span class="toggle-plus">＋</span><span class="toggle-x" style="display: none">✕</span>';
    const inlineToggle = el.querySelectorAll<HTMLDivElement>('.toggle.inline');
    inlineToggle.forEach(t => {
      // @ts-ignore
      if (t.postProcessed) return;
      // @ts-ignore
      t.postProcessed = true;
      t.innerHTML = toggleFaces;
      // @ts-ignore
      t.expanded = false;
      // @ts-ignore
      t.querySelector('.toggle-x').style.display = 'none';
      event('click', t, () => {
        // @ts-ignore
        t.querySelector('.toggle-plus').style.display = t.expanded ? 'block' : 'none';
        // @ts-ignore
        t.querySelector('.toggle-x').style.display = !t.expanded ? 'block' : 'none';
        // @ts-ignore
        if (t.expanded) {
          t.nextSibling?.remove();
          // @ts-ignore
          t.expanded = !t.expanded;
        } else {
          // TODO: Don't use title to store url
          const url = t.title!;
          const type = this.editor.getUrlType(url);
          if (type === 'ref') {
            subscriptions.push(this.refs.getCurrent(this.editor.getRefUrl(url)).pipe(
              catchError(() => of(null)),
            ).subscribe(ref => {
              if (ref) {
                const c = createRef(vc, ref, true);
                t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
              } else {
                const warn = document.createElement('div');
                warn.innerHTML = `<span class="error">Ref ${escape(url)} not found.</span>`;
                t.parentNode?.insertBefore(warn, t.nextSibling);
              }
              // @ts-ignore
              t.expanded = !t.expanded;
            }));
          } else if (type === 'tag') {
            subscriptions.push(this.loadQuery$(url).subscribe(({params, page, ext}) => {
              const c = createLens(vc, params, page, this.editor.getQuery(url), ext);
              t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
              // @ts-ignore
              t.expanded = !t.expanded;
            }));
          }
        }
      });
    });
    const embedToggle = el.querySelectorAll<HTMLDivElement>('.toggle.embed');
    embedToggle.forEach(t => {
      // @ts-ignore
      if (t.postProcessed) return;
      // @ts-ignore
      t.postProcessed = true;
      t.innerHTML = toggleFaces;
      // @ts-ignore
      if (t.previousSibling?.innerText === 'toggle') {
        t.previousSibling?.remove();
      }
      // @ts-ignore
      t.expanded = false;
      // @ts-ignore
      t.querySelector('.toggle-x').style.display = 'none';
      event('click', t, () => {
        // @ts-ignore
        t.querySelector('.toggle-plus').style.display = t.expanded ? 'block' : 'none';
        // @ts-ignore
        t.querySelector('.toggle-x').style.display = !t.expanded ? 'block' : 'none';
        // @ts-ignore
        if (t.expanded) {
          t.nextSibling?.remove();
          // @ts-ignore
          t.expanded = false;
        } else {
          // TODO: Don't use title to store url
          const url = t.title!;
          const embeds = this.admin.getPluginsForUrl(url);
          if (embeds.length) {
            const c = createEmbed(vc, { url, origin, tags: embeds.map(p => p.tag) }, );
            t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
            // @ts-ignore
            t.expanded = !t.expanded;
          } else {
            const type = this.editor.getUrlType(url);
            if (type === 'tag') {
              subscriptions.push(this.loadQuery$(url).subscribe(({params, page, ext}) => {
                const c = createLens(vc, params, page, this.editor.getQuery(url), ext);
                t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
                // @ts-ignore
                t.expanded = !t.expanded;
              }));
            } else {
              subscriptions.push(this.refs.getCurrent(this.editor.getRefUrl(url)).pipe(
                catchError(() => of(null)),
              ).subscribe(ref => {
                if (ref) {
                  const expandPlugins = this.admin.getEmbeds(ref);
                  if (ref.comment || expandPlugins.length) {
                    const c = createEmbed(vc, { ...ref, tags: expandPlugins });
                    t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
                  } else {
                    const warn = document.createElement('div');
                    warn.innerHTML = `<span class="error">Ref ${escape(ref.title || ref.url)} does not contain any embeds.</span>`;
                    t.parentNode?.insertBefore(warn, t.nextSibling);
                  }
                } else {
                  const warn = document.createElement('div');
                  warn.innerHTML = `<span class="error">Ref ${escape(url)} not found and could not embed directly.</span>`;
                  t.parentNode?.insertBefore(warn, t.nextSibling);
                }
                // @ts-ignore
                t.expanded = !t.expanded;
              }));
            }
          }
        }
      });
    });
    const links = el.querySelectorAll<HTMLAnchorElement>('a[href]');
    links.forEach(t => {
      if (t.querySelectorAll('app-viewer').length) {
        // Don't allow linking images
        while (t.firstChild) t.parentNode?.insertBefore(t.firstChild, t);
        t.remove();
        return;
      }
      const c = createLink(vc, t.getAttribute('href') || '', t.innerText, t.title, t.className);
      t.parentNode?.insertBefore(c.location.nativeElement, t);
      t.remove();
    });
    return () => subscriptions.forEach(s => s.unsubscribe());
  }

  private get iframeBg() {
    return getComputedStyle(document.body).backgroundColor;
  }

  async writeIframe(oembed: Oembed, iframe: HTMLIFrameElement, width = '100px', scroll = true) {
    iframe.style.width = (oembed.width ? oembed.width + 'px' : width);
    if (oembed.height) iframe.style.height = oembed.height + 'px';
    if (oembed.html) {
      if (oembed.html.startsWith('<iframe')) {
        iframe.src = embedUrl(parseSrc(oembed.html));
      } else {
        this.writeIframeHtml(oembed.html || '', iframe, scroll);
      }
    } else {
      iframe.src = embedUrl(oembed.url);
    }
    if (!oembed.height) {
      iframe.style.height = (oembed.width ? oembed.width + 'px' : width);
      const doCheck = async () => {
        let doc: Document | undefined;
        try {
          doc = iframe.contentWindow?.document;
        } catch (e) {
          // Cross origin
          return;
        }
        if (!doc) {
          await delay(100);
          await doCheck();
          return;
        }
        let start = DateTime.now();
        let oldHeight = doc.body.scrollHeight;
        let newHeight = false;
        const f = async () => {
          let doc: Document;
          try {
            doc = iframe.contentWindow!.document;
          } catch (e) {
            // Cross origin
            return;
          }
          if (document.fullscreenElement) return;
          const h = doc.body.scrollHeight;
          if (h !== oldHeight) {
            newHeight = true;
            start = DateTime.now();
            oldHeight = h;
            iframe.style.height = h + 'px';
          }
          await delay(100);
          if ((!newHeight || h < 300) && start > DateTime.now().minus({ seconds: 5 })) {
            // Keep checking height
            await f();
          } else if (start > DateTime.now().minus({ seconds: 30 })) {
            // Timeout checking height less than 5 seconds since the last change
            f(); // Keep checking height until 30 seconds timeout but let promise resolve
          }
        };
        await f();

      };
      await doCheck();
    }
  }

  writeIframeHtml(html: string, iframe: HTMLIFrameElement, scroll = true) {
    const blob = new Blob([transparentIframe(html, this.iframeBg, scroll ? 'auto' : 'hidden')], {type: 'text/html'});
    const blobUrl = URL.createObjectURL(blob);
    iframe.addEventListener('load', () => {
      URL.revokeObjectURL(blobUrl);
    }, { once: true });
    iframe.src = blobUrl;
  }

  loadQuery$(url: string):  Observable<{params: any, page: Page<Ref>, ext?: Ext}> {
    const query = this.editor.getQuery(url);
    const params = parseParams(url);
    const view: string = params.view;
    const filterQuery = getFiltersQuery(params.filter);
    const fullQuery = query && filterQuery ? query + ':' + filterQuery : query || filterQuery || '';
    const args = parseArgs(params);
    return forkJoin({
      params: of(params),
      page: this.refs.page({query: fullQuery, ...args}),
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
    const t = this.admin.view.find(t => hasPrefix(view, t.tag));
    if (t) {
      return { tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, view: t.config?.view } };
    }
    return undefined;
  }
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
    <body>${content}</body>
  </html>
  `;
}
