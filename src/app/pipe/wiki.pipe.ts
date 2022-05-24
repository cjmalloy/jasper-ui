import { Pipe, PipeTransform } from '@angular/core';
// @ts-ignore
import * as Wiky from 'wiky';

@Pipe({
  name: 'wiki'
})
export class WikiPipe implements PipeTransform {

  transform(wikitext: string): string {
    return Wiky.toHtml(wikitext);
  }

}
