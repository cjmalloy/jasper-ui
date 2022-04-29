import { Pipe, PipeTransform } from '@angular/core';
import { youtubeHosts } from '../util/hosts';

@Pipe({
  name: 'embed',
  pure: true
})
export class EmbedPipe implements PipeTransform {

  transform(value: string): unknown {
    try {
      const url = new URL(value);
      if (youtubeHosts.includes(url.host) && url.searchParams.has('v')) {
        const videoId = url.searchParams.get('v');
        return 'https://www.youtube.com/embed/' + videoId;
      }
    } catch (e) {}
    return value;
  }

}
