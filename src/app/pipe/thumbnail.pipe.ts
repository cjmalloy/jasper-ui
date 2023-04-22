import { Pipe, PipeTransform } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Ref } from '../model/ref';
import { OembedStore } from '../store/oembed';
import { hasTag } from '../util/tag';

@Pipe({
  name: 'thumbnail',
  pure: true
})
export class ThumbnailPipe implements PipeTransform {

  constructor(
    private store: OembedStore,
  ) { }

  transform(ref: Ref): Observable<string> {
    if (ref.plugins?.['plugin/thumbnail']?.url) return of(ref.plugins?.['plugin/thumbnail']?.url);
    if (ref.plugins?.['plugin/image']?.url) return of(ref.plugins?.['plugin/image']?.url);
    if (ref.plugins?.['plugin/video']?.url) return of(ref.plugins?.['plugin/video']?.url);
    if (hasTag('plugin/embed', ref)) {
      return this.store.get(ref.plugins?.['plugin/embed']?.url || ref.url).pipe(
        map(oembed => {
          if (oembed.thumbnail_url) {
            return oembed.thumbnail_url;
          }
          return ref.url;
        }),
      );
    }
    return of(ref.url);
  }

}
