import { Pipe, PipeTransform } from '@angular/core';
import { AdminService } from '../service/admin.service';

@Pipe({
  name: 'plugins',
  pure: true,
})
export class PluginsPipe implements PipeTransform {

  constructor(
    private admin: AdminService,
  ) { }

  transform(tags: string[]): string[] {
    return tags.map( t => {
      const i = this.admin.getIcons([t])
        .find(i => i.tag === t);
      if (!i) return $localize`🏷️` + ' ' + t;
      return i.label;
    });
  }

}
