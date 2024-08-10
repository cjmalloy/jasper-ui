import { Pipe, PipeTransform } from '@angular/core';
import { ImageService } from '../service/image.service';

@Pipe({
  name: 'proxy',
  pure: true
})
export class ProxyPipe implements PipeTransform {

  constructor(
    private imgs: ImageService,
  ) { }

  async transform(url: string | null): Promise<string | null> {
    if (!url) return url;
    return this.imgs.getImage(url)
      .then(res => {
        if (res.url) {
          return res.url;
        } else {
          return url;
        }
      });
  }

}
