import { Component, inject, viewChild } from '@angular/core';
import { TemplateListComponent } from '../../../component/template/template-list/template-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { ModService } from '../../../service/mod.service';
import { TemplateStore } from '../../../store/template';
import { Store } from '../../../store/store';
import { getTagFilter, getTagQueryFilter } from '../../../util/query';

@Component({
  selector: 'app-settings-template-page',
  templateUrl: './template.component.html',
  imports: [TemplateListComponent],
})
export class SettingsTemplatePage implements HasChanges {
  private mod = inject(ModService);
  store = inject(Store);
  query = inject(TemplateStore);

  readonly list = viewChild<TemplateListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Settings: Templates`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    this.query.watch(() => ({
      query: getTagQueryFilter(this.store.view.showRemotes() ? '@*' : (this.store.account.origin() || '*'), this.store.view.filter()),
      search: this.store.view.search(),
      sort: [...this.store.view.sort()],
      page: this.store.view.pageNumber(),
      size: this.store.view.pageSize(),
      ...getTagFilter(this.store.view.filter()),
    }));
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }
}
