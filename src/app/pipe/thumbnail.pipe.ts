import { Pipe, PipeTransform } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Ref } from '../model/ref';
import { OEmbedService } from '../service/api/oembed.service';
import { hasTag } from '../util/tag';

@Pipe({
  name: 'thumbnail',
  pure: true
})
export class ThumbnailPipe implements PipeTransform {

  constructor(
    private oembeds: OEmbedService,
  ) { }

  transform(ref: Ref): Observable<string> {
    if (ref.plugins?.['plugin/thumbnail']?.url) return of(ref.plugins?.['plugin/thumbnail']?.url);
    if (hasTag('plugin/embed', ref)) {
      return this.oembeds.get(ref.plugins?.['plugin/embed']?.url || ref.url).pipe(
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
