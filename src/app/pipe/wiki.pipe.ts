import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'wiki'
})
export class WikiPipe implements PipeTransform {

  transform(wikitext: string): string {
    const w = window as any;
    w.wtf.plugin(w.wtfMarkdown);
    return w.wtf(wikitext).markdown();
  }

}
