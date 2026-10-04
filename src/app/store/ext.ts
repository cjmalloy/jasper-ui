import { Injectable, inject } from '@angular/core';
import { Ext } from '../model/ext';
import { TagPageArgs } from '../model/tag';
import { ExtService } from '../service/api/ext.service';
import { PageStore } from '../util/page-store';

@Injectable({
  providedIn: 'root'
})
export class ExtStore extends PageStore<TagPageArgs, Ext> {
  private exts = inject(ExtService);

  protected load(args: TagPageArgs) {
    return this.exts.page(args);
  }
}
