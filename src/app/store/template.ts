import { inject, Injectable } from '@angular/core';
import { TagPageArgs } from '../model/tag';
import { Template } from '../model/template';
import { TemplateService } from '../service/api/template.service';
import { PageStore } from '../util/page-store';

@Injectable({
  providedIn: 'root'
})
export class TemplateStore extends PageStore<TagPageArgs, Template> {
  private templates = inject(TemplateService);

  protected load(args: TagPageArgs) {
    return this.templates.page(args);
  }
}
