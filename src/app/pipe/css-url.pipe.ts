import { Pipe, PipeTransform } from '@angular/core';
import { ProxyService } from '../service/api/proxy.service';

@Pipe({
    name: 'cssUrl',
    pure: true
})
export class CssUrlPipe implements PipeTransform {

  constructor(
    private proxy: ProxyService,
  ) { }

  transform(url: string | null, skip = ''): string | null {
    if (!url) return '';
    url = url.trim();
    skip = skip.trim();
    if (!url || url === skip || this.proxy.isProxied(url) === skip) return '';
    return `url("${url}")`;
  }

}
