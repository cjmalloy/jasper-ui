import { inject, Injectable } from '@angular/core';
import { Plugin } from '../model/plugin';
import { TagPageArgs } from '../model/tag';
import { PluginService } from '../service/api/plugin.service';
import { PageStore } from '../util/page-store';

@Injectable({
  providedIn: 'root'
})
export class PluginStore extends PageStore<TagPageArgs, Plugin> {
  private plugins = inject(PluginService);

  protected load(args: TagPageArgs) {
    return this.plugins.page(args);
  }
}
