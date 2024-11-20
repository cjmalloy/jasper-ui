import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'cssUrl',
  pure: true
})
export class CssUrlPipe implements PipeTransform {

  transform(url: string | null): string | null {
    if (!url) return '';
    return `url("${url}")`;
  }

}
