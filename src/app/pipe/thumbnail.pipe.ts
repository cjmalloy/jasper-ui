import { Pipe, PipeTransform } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
import { ProxyService } from '../service/api/proxy.service';
import { OembedStore } from '../store/oembed';
import { hasTag } from '../util/tag';

type ThumbnailRef = Pick<Ref, 'url' | 'origin' | 'plugins' | 'tags'>;

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

  transform(refs: (ThumbnailRef | undefined)[], force = false, prefetch = true): Observable<string> {
    const imagesEnabled = !!this.admin.getPlugin('plugin/image');
    for (const ref of refs) {
      if (!ref) continue;
      const thumbnailUrl = refUrl(ref, 'plugin/thumbnail');
      if (thumbnailUrl && (imagesEnabled || isInlineSvg(thumbnailUrl))) {
        return of(this.fetchUrl(thumbnailUrl, ref.origin, 'plugin/thumbnail', prefetch));
      }
      if (!imagesEnabled) continue;
      for (const plugin of ['plugin/image', 'plugin/video']) {
        if (refUrl(ref, plugin)) return of(this.fetchUrl(refUrl(ref, plugin), ref.origin, plugin, prefetch));
      }
      if (hasTag('plugin/embed', ref)) {
        return this.store.get(ref.plugins?.['plugin/embed']?.url || ref.url).pipe(
          map(oembed => {
            if (oembed?.thumbnail_url) {
              return this.fetchUrl(oembed.thumbnail_url, ref.origin, 'plugin/thumbnail', prefetch);
            }
            return '';
          }),
        );
      }
      if (!this.validUrl(ref.url)) continue;
      const embedPlugins = this.admin.getEmbeds(ref);
      for (const plugin of ['plugin/image', 'plugin/video']) {
        if (embedPlugins.includes(plugin)) return of(this.fetchUrl(ref.url, ref.origin, plugin, prefetch));
      }
    }
    if (imagesEnabled && force) {
      for (const ref of refs) {
        if (!this.validUrl(ref?.url)) continue;
        return of(this.fetchUrl(ref!.url, ref!.origin, 'plugin/image', prefetch));
      }
    }
    return of('');
  }

  fetchUrl(url: string, origin: string | undefined, plugin: string, prefetch: boolean) {
    if (!url) return '';
    if (isInlineSvg(url)) return url;
    if (url.startsWith('cache:') || this.admin.getPlugin(plugin)?.config?.proxy) {
      return this.proxy.getFetch(url, origin, 'thumbnail', true, prefetch);
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

export function isInlineSvg(url: string) {
  return /^data:image\/svg\+xml(?:[,;])/i.test(url);
}
