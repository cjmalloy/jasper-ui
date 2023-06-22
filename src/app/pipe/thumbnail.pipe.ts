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
      if (ref.plugins?.['plugin/thumbnail']?.url) return of(this.cssUrl(ref.plugins?.['plugin/thumbnail']?.url));
      if (ref.plugins?.['plugin/image']?.url) return of(this.cssUrl(ref.plugins?.['plugin/image']?.url));
      if (ref.plugins?.['plugin/video']?.url) return of(this.cssUrl(ref.plugins?.['plugin/video']?.url));
      if (hasTag('plugin/embed', ref)) {
        return this.store.get(ref.plugins?.['plugin/embed']?.url || ref.url).pipe(
          map(oembed => {
            if (oembed?.thumbnail_url) {
              return this.cssUrl(oembed.thumbnail_url);
            }
            return '';
          }),
        );
      }
    }
    for (const ref of refs) {
      if (!ref) continue;
      return of(this.cssUrl(ref.url));
    }
    return of('');
  }

  cssUrl(url: string | null) {
    if (!url) return '';
    if (this.admin.status.plugins.thumbnail?.config?.cache) {
      url = this.scraper.getFetch(url);
    }
    return `url("${url}")`;
  }

}
