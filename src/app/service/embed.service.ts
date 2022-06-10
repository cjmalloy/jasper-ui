import { Injectable, ViewContainerRef } from '@angular/core';
import * as _ from 'lodash';
import { marked } from 'marked';
import * as moment from 'moment';
import { MarkdownService } from 'ngx-markdown';
import { catchError, map, Observable, of } from 'rxjs';
import { EmbedComponent } from '../component/embed/embed.component';
import { RefListComponent } from '../component/ref-list/ref-list.component';
import { RefComponent } from '../component/ref/ref.component';
import { isAudio } from '../plugin/audio';
import { isKnownEmbed } from '../plugin/embed';
import { isImage } from '../plugin/image';
import { isKnownThumbnail } from '../plugin/thumbnail';
import { isVideo } from '../plugin/video';
import { wikiUriFormat } from '../util/format';
import { bitchuteHosts, getHost, getUrl, twitterHosts, youtubeHosts } from '../util/hosts';
import { AdminService } from './admin.service';
import { CorsBusterService } from './api/cors-buster.service';
import { RefService } from './api/ref.service';
import { ConfigService } from './config.service';
import { EditorService } from './editor.service';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class EmbedService {

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private config: ConfigService,
    private cors: CorsBusterService,
    private editor: EditorService,
    private refs: RefService,
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
      if (text.toLowerCase().trim() === 'toggle' || isKnownEmbed(href) || isImage(href) || isVideo(href) || isAudio(href)) {
        return html + `<span class="toggle embed" title="${href}"><span class="toggle-plus">＋</span></span>`;
      }
      const type = this.editor.getUrlType(href);
      if (type === 'ref' || type === 'tag') {
        return html + `<span class="toggle inline" title="${href}"><span class="toggle-plus">＋</span></span>`;
      }
      return html;
    }
    const renderImage = markdownService.renderer.image;
    markdownService.renderer.image = (href: string | null, title: string | null, text: string) => {
      let html = renderImage.call(markdownService.renderer, href, title, text);
      return html.replace('<img', '<img class="md-img"');
    }
    marked.use({ extensions: this.extensions });
  }

  private get extensions() {
    return [{
      name: 'userTag',
      level: 'inline',
      start: (src: string) => src.match(/[+_]/)?.index,
      tokenizer(src: string, tokens: any) {
        const rule = /^([+_]user\/[a-z]+(\/[a-z]+)*)/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'userTag',
            href: '/tag/' + encodeURIComponent(match[0]),
            text: match[0],
            title: 'User ' + match[0],
            raw: match[0],
            tokens: []
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a href="${token.href}" title="${token.title}">${token.text}</a>`;
      }
    }, {
      name: 'hashTag',
      level: 'inline',
      start: (src: string) => src.match(/#/)?.index,
      tokenizer(src: string, tokens: any) {
        const rule = /^#([a-z]+(\/[a-z]+)*)/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'hashTag',
            href: '/tag/' + encodeURIComponent(match[1]),
            text: match[0],
            title: 'Hashtag ' + match[0],
            raw: match[0],
            tokens: []
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a href="${token.href}" title="${token.title}">${token.text}</a>`;
      }
    }, {
      name: 'wiki',
      level: 'inline',
      start: (src: string) => src.match(/\[\[/)?.index,
      tokenizer(src: string, tokens: any) {
        const rule = /^\[\[([^\]]+)]]/;
        const match = rule.exec(src);
        if (match) {
          // Don't match on source or alt refs
          if (/^(alt)?\d+$/.test(match[1])) return undefined;
          return {
            type: 'wiki',
            href: '/ref/' + wikiUriFormat(match[1]),
            text: match[1],
            raw: match[0],
            tokens: []
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a href="${token.href}">${token.text}</a>`;
      }
    }, {
      name: 'embed',
      level: 'inline',
      start: (src: string) => src.match(/\[(ref|embed|query)]/)?.index,
      tokenizer(src: string, tokens: any) {
        const rule = /^\[(ref|embed|query)]\(([^\]]+)\)/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'embed',
            css: match[1],
            text: match[2],
            raw: match[0],
            tokens: []
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a href="${token.href}" class="inline-${token.css}">${token.text}</a>`;
      }
    }];
  }

  postProcess(el: HTMLDivElement, vc: ViewContainerRef, event: (type: string, el: Element, fn: () => void) => void) {
    const images = el.querySelectorAll<HTMLImageElement>('.md-img');
    images.forEach(t => {
      const c = vc.createComponent(EmbedComponent);
      c.instance.ref = { url: t.src };
      c.instance.expandPlugins = ['plugin/image'];
      t.parentNode?.insertBefore(c.location.nativeElement, t);
      t.remove();
    });
    const inlineRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-ref');
    inlineRefs.forEach(t => {
      this.refs.get(this.editor.getRefUrl(t.innerText)).subscribe(ref => {
        const c = vc.createComponent(RefComponent);
        c.instance.ref = ref;
        c.instance.showToggle = true;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
        t.remove();
      });
    });
    const embedRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-embed');
    embedRefs.forEach(t => {
      this.refs.get(this.editor.getRefUrl(t.innerText)).subscribe(ref => {
        const expandPlugins = this.admin.getEmbeds(ref);
        if (ref.comment || expandPlugins.length) {
          const c = vc.createComponent(EmbedComponent);
          c.instance.ref = ref;
          c.instance.expandPlugins = expandPlugins;
          t.parentNode?.insertBefore(c.location.nativeElement, t);
        }
        t.remove();
      });
    });
    const inlineQueries = el.querySelectorAll<HTMLAnchorElement>('.inline-query');
    inlineQueries.forEach(t => {
      const [query, sort] = this.editor.getQueryUrl(t.innerText);
      this.refs.page({ query, sort: [sort] }).subscribe(page => {
        const c = vc.createComponent(RefListComponent);
        c.instance.page = page;
        c.instance.pageControls = false;
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
            this.refs.get(this.editor.getRefUrl(url)).subscribe(ref => {
              const c = vc.createComponent(RefComponent);
              c.instance.ref = ref;
              c.instance.showToggle = true;
              t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
              // @ts-ignore
              t.expanded = !t.expanded;
            });
          } else if (type === 'tag') {
            const [query, sort] = this.editor.getQueryUrl(url);
            // @ts-ignore
            this.refs.page({ query, sort: [sort], ...Object.fromEntries(new URL(url).searchParams) }).subscribe(page => {
              const c = vc.createComponent(RefListComponent);
              c.instance.page = page;
              c.instance.pageControls = false;
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
          if (isKnownEmbed(url) || isImage(url) || isVideo(url) || isAudio(url)) {
            const c = vc.createComponent(EmbedComponent);
            c.instance.ref = { url };
            if (isImage(url)) {
              c.instance.expandPlugins = ['plugin/image'];
            } else if (isVideo(url)) {
              c.instance.expandPlugins = ['plugin/video'];
            }  else if (isAudio(url)) {
              c.instance.expandPlugins = ['plugin/audio'];
            } else if (isKnownEmbed(url)) {
              c.instance.expandPlugins = ['plugin/embed'];
            }
            t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
            // @ts-ignore
            t.expanded = !t.expanded;
          } else {
            const type = this.editor.getUrlType(url);
            if (type === 'tag') {
              const [query, sort] = this.editor.getQueryUrl(url);
              this.refs.page({query, sort: [sort]}).subscribe(page => {
                const c = vc.createComponent(RefListComponent);
                c.instance.page = page;
                c.instance.pageControls = false;
                t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
                // @ts-ignore
                t.expanded = !t.expanded;
              });
            } else {
              this.refs.get(this.editor.getRefUrl(url)).subscribe(ref => {
                const expandPlugins = this.admin.getEmbeds(ref);
                if (ref.comment || expandPlugins.length) {
                  const c = vc.createComponent(EmbedComponent);
                  c.instance.ref = ref;
                  c.instance.expandPlugins = expandPlugins;
                  t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
                  // @ts-ignore
                  t.expanded = !t.expanded;
                }
              });
            }
          }
        }
      });
    });
  }

  private get twitterTheme() {
    return this.theme.getTheme() === 'dark-theme' ? 'dark' : undefined;
  }

  private get iframeBg() {
    return getComputedStyle(document.body).backgroundColor;
  }

  fixUrl(url: string) {
    const parsed = getUrl(url);
    if (!parsed) return url;
    if (youtubeHosts.includes(parsed.host) && parsed.searchParams.has('v')) {
      const videoId = parsed.searchParams.get('v');
      return 'https://www.youtube.com/embed/' + videoId;
    }
    if (bitchuteHosts.includes(parsed.host)) {
      return url.replace('bitchute.com/video/', 'bitchute.com/embed/');
    }
    if (twitterHosts.includes(parsed.host)) {
      return 'about:blank';
    }
    return url;
  }

  writeIframe(url: string, iFrame: HTMLIFrameElement) {
    const host = getHost(url);
    if (!host) return;
    if (twitterHosts.includes(host)) {
      const width = 400;
      const height = 400;
      this.cors.twitter(url, this.twitterTheme, width, height).subscribe(tweet => {
        iFrame.width = tweet.width + 'px';
        iFrame.height = (tweet.height || '100') + 'px';
        const doc = iFrame.contentWindow!.document;
        doc.open();
        doc.write(transparentIframe(tweet.html!, this.iframeBg));
        doc.close();
        if (!tweet.height) {
          const start = moment();
          let oldHeight = doc.body.scrollHeight;
          const f = () => {
            const h = doc.body.scrollHeight;
            if (h !== oldHeight) {
              iFrame.height = h + 'px';
              oldHeight = h;
            }
            if (start.isAfter(moment().subtract(3, 'seconds'))) {
              _.defer(f);
            }
          };
          f();
        }
      })
      return;
    }
  }

  getThumbnail(ref: string): Observable<string | undefined> {
    if (!isKnownThumbnail(ref)) return of(undefined);
    const host = getHost(ref)!;
    if (bitchuteHosts.includes(host)) {
      return this.cors.bitChute(ref).pipe(
        map(embed => embed.thumbnail_url),
        catchError(err => of(undefined)),
      );
    }
    return of(undefined);
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
    }
    </style>
  </head>
    <body>${content}</body>
  </html>
  `;
}
