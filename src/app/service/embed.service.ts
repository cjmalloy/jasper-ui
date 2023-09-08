import { Injectable } from '@angular/core';
import { escape, uniq } from 'lodash-es';
import { marked } from 'marked';
import * as moment from 'moment';
import { MarkdownService } from 'ngx-markdown';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { Ext } from '../model/ext';
import { Oembed } from '../model/oembed';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { wikiUriFormat } from '../mods/wiki';
import { Store } from '../store/store';
import { delay } from '../util/async';
import { Embed } from '../util/embed';
import { parseParams } from '../util/http';
import { getFilters, getFiltersQuery, parseArgs } from '../util/query';
import { isQuery, queryPrefix, tagOrigin, topAnds } from '../util/tag';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { EditorService } from './editor.service';

@Injectable({
  providedIn: 'root'
})
export class EmbedService {

  constructor(
    private store: Store,
    private admin: AdminService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private markdownService: MarkdownService,
  ) {
    markdownService.options = {
      gfm: true,
      breaks: false,
      pedantic: false,
      smartLists: true,
      smartypants: true,
    };
    const renderLink = markdownService.renderer.link;
    markdownService.renderer.link = (href: string | null, title: string | null, text: string) => {
      let html = renderLink.call(markdownService.renderer, href, title, text);
      if (!href) return html;
      if (text.toLowerCase().trim() === 'toggle' || this.admin.getPluginsForUrl(href).length) {
        return html + `<span class="toggle embed" title="${href}"><span class="toggle-plus">＋</span></span>`;
      }
      const type = this.editor.getUrlType(href);
      if (type === 'ref' || type === 'tag') {
        return html + `<span class="toggle inline" title="${href}"><span class="toggle-plus">＋</span></span>`;
      }
      return html;
    }
    marked.use({extensions: this.extensions});
  }

  private get extensions() {
    const self = this;
    return [{
      name: 'userTag',
      level: 'inline',
      start: (src: string) => src.match(/[+_]/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^([+_]user\/[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?)/;
        const match = rule.exec(src);
        if (match) {
          const text = match[0]
          const title = 'User ' + text;
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
        const rule = /^#([a-z0-9]+([./][a-z0-9]+)*)/;
        const match = rule.exec(src);
        if (match) {
          const text = match[0];
          const title = 'Hashtag ' + text;
          return {
            type: 'hashTag',
            href: '/tag/' + match[1],
            text,
            title,
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
        const rule = /^\[!\[([^\]]+)]]/;
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
          return `<a class="inline-embed">${token.href}</a>`;
        }
      }
    }, {
      name: 'embed',
      level: 'inline',
      start: (src: string) => src.match(/\[(ref|embed|query)]/)?.index,
      tokenizer(src: string, tokens: any): any {
        const rule = /^\[(ref|embed|query)]\(([^\]]+)\)/;
        const match = rule.exec(src);
        if (match) {
          const css = match[1];
          const text = match[2];
          return {
            type: 'embed',
            css,
            text,
            raw: match[0],
            tokens: [],
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a class="inline-${token.css}">${token.text}</a>`;
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
   * @param el the div containing the rendered markdown
   * @param embed interface that injects components
   * @param event callback to add event handlers without memory leaks
   * @param origin origin to append to user links without existing origins
   */
  postProcess(el: HTMLDivElement, embed: Embed, event: (type: string, el: Element, fn: () => void) => void, origin = '') {
    if (origin) {
      const userTags = el.querySelectorAll<HTMLAnchorElement>('.user.tag');
      userTags.forEach(t => {
        if (tagOrigin(t.innerText)) return;
        t.href += origin;
      });
    }
    const images = el.querySelectorAll<HTMLImageElement>('img');
    images.forEach(t => {
      if (t.src || t.srcset) {
        const srcsets = t.srcset ? t.srcset.split(', ') : [t.src];
        const url = t.srcset ? srcsets[srcsets.length - 1].trim().split(' ')[0] : t.src;
        const config = {} as any;
        if (t.style.width) config.width = t.style.width;
        if (t.style.height) config.height = t.style.height;
        const c = embed.createEmbed({ url, plugins: { 'plugin/image': config } }, ['plugin/image']);
        c.location.nativeElement.title = t.title;
        c.location.nativeElement.alt = t.alt;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
      }
      t.remove();
    });
    const inlineRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-ref');
    inlineRefs.forEach(t => {
      const url = t.innerText;
      this.refs.get(this.editor.getRefUrl(url), this.store.account.origin).pipe(
        catchError(() => of(null)),
      ).subscribe(ref => {
        if (ref) {
          const c = embed.createRef(ref, true);
          t.parentNode?.insertBefore(c.location.nativeElement, t);
        } else {
          el = document.createElement('div');
          el.innerHTML = `<span class="error">Ref ${escape(url)} not found.</span>`;
          t.parentNode?.insertBefore(el, t);
        }
        t.remove();
      });
    });
    const embedRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-embed');
    embedRefs.forEach(t => {
      const url = t.innerText;
      this.refs.get(this.editor.getRefUrl(url), this.store.account.origin).pipe(
        catchError(() => of(null)),
      ).subscribe(ref => {
        if (ref) {
          const expandPlugins = this.admin.getEmbeds(ref);
          if (ref.comment || expandPlugins.length) {
            const c = embed.createEmbed(ref, expandPlugins);
            t.parentNode?.insertBefore(c.location.nativeElement, t);
          }
        } else {
          const embeds = this.admin.getPluginsForUrl(url);
          if (embeds.length) {
            const c = embed.createEmbed(url, embeds.map(p => p.tag));
            t.parentNode?.insertBefore(c.location.nativeElement, t);
          } else {
            el = document.createElement('div');
            el.innerHTML = `<span class="error">Ref ${escape(url)} not found and could not embed directly.</span>`;
            t.parentNode?.insertBefore(el, t);
          }
        }
        t.remove();
      });
    });
    const inlineQueries = el.querySelectorAll<HTMLAnchorElement>('.inline-query');
    inlineQueries.forEach(t => {
      this.loadQuery$(t.innerText).subscribe(({page, ext}) => {
        const c = embed.createLens(page, this.editor.getQuery(t.innerText), ext);
        t.parentNode?.insertBefore(c.location.nativeElement, t);
        t.remove();
      });
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
            this.refs.get(this.editor.getRefUrl(url), this.store.account.origin).pipe(
              catchError(() => of(null)),
            ).subscribe(ref => {
              if (ref) {
                const c = embed.createRef(ref, true);
                t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
              } else {
                el = document.createElement('div');
                el.innerHTML = `<span class="error">Ref ${escape(url)} not found.</span>`;
                t.parentNode?.insertBefore(el, t.nextSibling);
              }
              // @ts-ignore
              t.expanded = !t.expanded;
            });
          } else if (type === 'tag') {
            this.loadQuery$(url).subscribe(({page, ext}) => {
              const c = embed.createLens(page, this.editor.getQuery(url), ext);
              t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
              // @ts-ignore
              t.expanded = !t.expanded;
            });
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
      if (t.previousSibling.innerText === 'toggle') {
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
            const c = embed.createEmbed(url, embeds.map(p => p.tag));
            t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
            // @ts-ignore
            t.expanded = !t.expanded;
          } else {
            const type = this.editor.getUrlType(url);
            if (type === 'tag') {
              this.loadQuery$(url).subscribe(({page, ext}) => {
                const c = embed.createLens(page, this.editor.getQuery(url), ext);
                t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
                // @ts-ignore
                t.expanded = !t.expanded;
              });
            } else {
              this.refs.get(this.editor.getRefUrl(url), this.store.account.origin).pipe(
                catchError(() => of(null)),
              ).subscribe(ref => {
                if (ref) {
                  const expandPlugins = this.admin.getEmbeds(ref);
                  if (ref.comment || expandPlugins.length) {
                    const c = embed.createEmbed(ref, expandPlugins);
                    t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
                  } else {
                    el = document.createElement('div');
                    el.innerHTML = `<span class="error">Ref ${escape(ref.title || ref.url)} does not contain any embeds.</span>`;
                    t.parentNode?.insertBefore(el, t.nextSibling);
                  }
                } else {
                  el = document.createElement('div');
                  el.innerHTML = `<span class="error">Ref ${escape(url)} not found and could not embed directly.</span>`;
                  t.parentNode?.insertBefore(el, t.nextSibling);
                }
                // @ts-ignore
                t.expanded = !t.expanded;
              });
            }
          }
        }
      });
    });
    const links = el.querySelectorAll<HTMLAnchorElement>('a');
    links.forEach(t => {
      if (!this.editor.localUrl(t.href)) return;
      const c = embed.createLink(t.href, t.innerText, t.title, t.className);
      t.parentNode?.insertBefore(c.location.nativeElement, t);
      t.remove();
    });
  }

  private get iframeBg() {
    return getComputedStyle(document.body).backgroundColor;
  }

  async writeIframe(oembed: Oembed, iframe: HTMLIFrameElement, width = '100px') {
    iframe.style.width = (oembed.width ? oembed.width + 'px' : width);
    if (oembed.height) iframe.style.height = oembed.height + 'px';
    if (oembed.html) {
      this.writeIframeHtml(oembed.html || '', iframe);
    } else {
      iframe.src = oembed.url;
    }
    const doc = iframe.contentWindow!.document;
    if (!oembed.height) {
      let start = moment();
      let oldHeight = doc.body.scrollHeight;
      let newHeight = false;
      const f = async () => {
        if (document.fullscreenElement) return;
        const h = doc.body.scrollHeight;
        if (h !== oldHeight) {
          newHeight = true;
          start = moment();
          oldHeight = h;
          iframe.style.height = h + 'px';
        }
        await delay(100);
        if ((!newHeight || h < 300) && start.isAfter(moment().subtract(3, 'seconds'))) {
          // Keep checking height
          await f();
        } else if (start.isAfter(moment().subtract(20, 'seconds'))) {
          // Timeout checking height less than 3 seconds since the last change
          f(); // Keep checking height until 20 seconds timeout but let promise resolve
        }
      };
      await f();
    }
  }

  writeIframeHtml(html: string, iframe: HTMLIFrameElement) {
    const doc = iframe.contentWindow!.document;
    doc.open();
    doc.write(transparentIframe(html, this.iframeBg));
    doc.close();
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
    const t = this.admin.tmplView.find(t => t.tag === view);
    if (t) {
      return { tag: t.tag, origin: t.origin, name: t.config?.view || t.name, config: t.defaults };
    }
    return undefined;
  }
}

export function transparentIframe(content: string, bgColor: string) {
  return `
  <html>
  <head>
    <style>
    body {
      background-color: ${bgColor};
      overflow: hidden;
      margin: 0;
    }
    </style>
  </head>
    <body>${content}</body>
  </html>
  `;
}
