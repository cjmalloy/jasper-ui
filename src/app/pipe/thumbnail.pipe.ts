import { Pipe, PipeTransform } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
import { ProxyService } from '../service/api/proxy.service';
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
    private proxy: ProxyService,
  ) { }

  transform(refs: (Ref | undefined)[], force = false): Observable<string> {
    for (const ref of refs) {
      if (!ref) continue;
      for (const plugin of ['plugin/thumbnail', 'plugin/image', 'plugin/video']) {
        if (refUrl(ref, plugin)) return of(this.fetchUrl(refUrl(ref, plugin), ref.origin, plugin));
      }
      if (hasTag('plugin/embed', ref)) {
        return this.store.get(ref.plugins?.['plugin/embed']?.url || ref.url).pipe(
          map(oembed => {
            if (oembed?.thumbnail_url) {
              return this.fetchUrl(oembed.thumbnail_url, ref.origin, 'plugin/thumbnail');
            }
            return '';
          }),
        );
      }
      if (!this.validUrl(ref.url)) continue;
      const embedPlugins = this.admin.getEmbeds(ref);
      for (const plugin of ['plugin/image', 'plugin/video']) {
        if (embedPlugins.includes(plugin)) return of(this.fetchUrl(ref.url, ref.origin, plugin));
      }
    }
    if (force) {
      for (const ref of refs) {
        if (!this.validUrl(ref?.url)) continue;
        return of(this.fetchUrl(ref!.url, ref!.origin, 'plugin/image'));
      }
    }
    return of('');
  }

  fetchUrl(url: string, origin: string | undefined, plugin: string) {
    if (!url) return '';
    if (url.startsWith('cache:') || this.admin.getPlugin(plugin)?.config?.proxy) {
      return this.proxy.getFetch(url, origin, true);
    }
    return url;
  }

  private validUrl(url?: string) {
    return url
      && !url.startsWith('data:')
      && !url.startsWith('comment:')
      && !url.startsWith('internal:');
  }
}

function refUrl(ref: Ref, plugin: string) {
  return ref.plugins?.[plugin]?.url;
}
