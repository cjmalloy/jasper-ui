import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import * as moment from 'moment';
import { map } from 'rxjs';
import { getHost, getUrl, twitterHosts, youtubeHosts } from '../util/hosts';
import { params } from '../util/http';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class EmbedService {

  constructor(
    private http: HttpClient,
    private theme: ThemeService,
  ) { }

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
      this.http.get('https://publish.twitter.com/oembed?url=' + url, {
        params: params({
          dnt: true,
          theme: this.twitterTheme,
          maxwidth: width,
          maxheight: height,
        }),
      }).pipe(
        map(t => t as TweetData),
        // catchError(err => console.log(err) || null)
      ).subscribe((tweet: TweetData) => {
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

export interface TweetData {
  url: string,
  author_name: string,
  author_url: string,
  html: string,
  width: number | null,
  height: number | null,
  type: string,
  cache_age: string,
  provider_name: string,
  provider_url: string,
  version: string
}
