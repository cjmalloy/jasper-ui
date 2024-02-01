import { Pipe, PipeTransform } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
import { ScrapeService } from '../service/api/scrape.service';
import { OembedStore } from '../store/oembed';
import { hasTag } from '../util/tag';

@Pipe({
  name: 'thumbnail',
  pure: true
})
export class ThumbnailPipe implements PipeTransform {

  constructor(
    private admin: AdminService,
    private store: OembedStore,
    private scraper: ScrapeService,
  ) { }

  transform(refs: (Ref | undefined)[]): Observable<string | null> {
    for (const ref of refs) {
      if (!ref) continue;
      for (const plugin of ['plugin/thumbnail', 'plugin/image', 'plugin/video']) {
        if (refUrl(ref, plugin)) return of(cssUrl(this.fetchUrl(refUrl(ref, plugin), plugin)));
      }
      if (hasTag('plugin/embed', ref)) {
        return this.store.get(ref.plugins?.['plugin/embed']?.url || ref.url).pipe(
          map(oembed => {
            if (oembed?.thumbnail_url) {
              return cssUrl(this.fetchUrl(oembed.thumbnail_url, 'plugin/thumbnail'));
            }
            return '';
          }),
        );
      }
      const embedPlugins = this.admin.getEmbeds(ref);
      for (const plugin of ['plugin/image', 'plugin/video']) {
        if (embedPlugins.includes(plugin)) return of(cssUrl(this.fetchUrl(ref.url, plugin)));
      }
    }
    for (const ref of refs) {
      if (!ref) continue;
      return of(cssUrl(ref.url));
    }
    return of('');
  }

  fetchUrl(url: string, plugin: string) {
    if (!url) return '';
    if (this.admin.getPlugin(plugin)?.config?.cache) {
      return this.scraper.getFetch(url, true);
    }
    return url;
  }

}

function refUrl(ref: Ref, plugin: string) {
  return ref.plugins?.[plugin]?.url;
}

function cssUrl(url: string | null) {
  if (!url) return '';
  return `url("${url}")`;
}
