import { Injectable, ViewContainerRef } from '@angular/core';
import * as _ from 'lodash';
import { marked } from 'marked';
import * as moment from 'moment';
import { MarkdownService } from 'ngx-markdown';
import { RefComponent } from '../component/ref/ref.component';
import { getHost, getUrl, twitterHosts, youtubeHosts } from '../util/hosts';
import { CorsBusterService } from './api/cors-buster.service';
import { RefService } from './api/ref.service';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class EmbedService {

  constructor(
    private theme: ThemeService,
    private cors: CorsBusterService,
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
      if (href?.startsWith(document.baseURI)) {
        html += `<span class="toggle inline" title="${href}"><span class="toggle-plus">＋</span><span class="toggle-x">✕</span></span>`;
      }
      return html;
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
            href: '/ref/wiki:' + encodeURIComponent(match[1].replace(/\s+/, '_')),
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
      name: 'ref',
      level: 'inline',
      start: (src: string) => src.match(/\[ref]/)?.index,
      tokenizer(src: string, tokens: any) {
        const rule = /^\[ref]\(([^\]]+)\)/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'ref',
            href: match[1],
            text: match[1],
            raw: match[0],
            tokens: []
          };
        }
        return undefined;
      },
      renderer(token: any): string {
        return `<a href="${token.href}" class="inline-ref">${token.text}</a>`;
      }
    }];
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
        doc.write(transparentIframe(tweet.html, this.iframeBg));
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

  private refPrefix = document.baseURI + 'ref/';
  getRefUrl(url: string): string {
    if (url.startsWith(this.refPrefix)) {
      let ending = url.substring(this.refPrefix.length);
      ending = ending.substring(0, ending.indexOf('/'))
      return decodeURI(ending);
    }
    return url;
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
