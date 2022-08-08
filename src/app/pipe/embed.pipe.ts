import { Pipe, PipeTransform } from '@angular/core';
import { EmbedService } from '../service/embed.service';

@Pipe({
  name: 'embed',
  pure: true
})
export class EmbedPipe implements PipeTransform {

  constructor(
    private embed: EmbedService,
  ) { }

  transform(value: string): unknown {
    return this.embed.fixUrl(value);
  }

}
