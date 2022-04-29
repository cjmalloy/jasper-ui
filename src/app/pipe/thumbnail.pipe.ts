import { Pipe, PipeTransform } from '@angular/core';
import { Ref } from '../model/ref';
import { imgurHosts, youtubeHosts } from '../util/hosts';

@Pipe({
  name: 'thumbnail',
  pure: true
})
export class ThumbnailPipe implements PipeTransform {

  transform(ref: Ref): string {
    if (ref.plugins?.['plugin/thumbnail']?.url) return ref.plugins?.['plugin/thumbnail']?.url;
    try {
      const url = new URL(ref.url);
      if (youtubeHosts.includes(url.host) && url.searchParams.has('v')) {
        const videoId = url.searchParams.get('v');
        return `https://i3.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
      if (imgurHosts.includes(url.host)) {
        if (url.pathname.includes('.')) {
          url.pathname = url.pathname.substring(0, url.pathname.indexOf('.')) + '.png';
        }
        return url.toString();
      }
    } catch (e) {}
    return ref.url;
  }

}
