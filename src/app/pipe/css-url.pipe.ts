import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'cssUrl',
    pure: true
})
export class CssUrlPipe implements PipeTransform {

  transform(url: string | null, skip = ''): string | null {
    if (!url || url === skip) return '';
    return `url("${url}")`;
  }

}
