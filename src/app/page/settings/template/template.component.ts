import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal, viewChild } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { TemplateListComponent } from '../../../component/template/template-list/template-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { mapTemplate, Template } from '../../../model/template';
import { TemplateService } from '../../../service/api/template.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { TemplateStore } from '../../../store/template';
import { printError } from '../../../util/http';
import { getTagFilter, getTagQueryFilter } from '../../../util/query';
import { getModels, getZipOrTextFile } from '../../../util/zip';

@Component({
  selector: 'app-settings-template-page',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  imports: [TemplateListComponent],
})
export class SettingsTemplatePage implements HasChanges {
  private mod = inject(ModService);
  store = inject(Store);
  query = inject(TemplateStore);
  private templates = inject(TemplateService);


  readonly serverError = signal<string[]>([]);

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

  upload(files?: FileList) {
    this.serverError.set([]);
    if (!files || !files.length) return;
    getZipOrTextFile(files[0]!, 'template.json')
      .then(json => getModels<Template>(json))
      .then(plugins => plugins.map(mapTemplate))
      .then(plugins => plugins.map(p => this.uploadTemplate(p)))
      .catch(err => this.serverError.set([err]));
  }

  uploadTemplate(template: Template) {
    return this.templates.delete(template.tag + this.store.account.origin()).pipe(
      switchMap(() => this.templates.create({ ...template, origin: this.store.account.origin() })),
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(() => this.query.refresh());
  }
}
