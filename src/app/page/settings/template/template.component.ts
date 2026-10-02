import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, viewChild, effect, inject, Injector, signal } from '@angular/core';
import { defer } from 'lodash-es';
import { catchError, switchMap, throwError } from 'rxjs';
import { TemplateListComponent } from '../../../component/template/template-list/template-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { mapTemplate, Template } from '../../../model/template';
import { TemplateService } from '../../../service/api/template.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { TemplateStore } from '../../../store/template';
import { printError } from '../../../util/http';
import { getTagFilter } from '../../../util/query';
import { getModels, getZipOrTextFile } from '../../../util/zip';

@Component({
  selector: 'app-settings-template-page',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TemplateListComponent],
})
export class SettingsTemplatePage implements OnInit, OnDestroy, HasChanges {

  private readonly injector = inject(Injector);

  readonly serverError = signal<string[]>([]);

  readonly list = viewChild<TemplateListComponent>('list');

  constructor(
    private mod: ModService,
    public store: Store,
    public query: TemplateStore,
    private templates: TemplateService,
  ) {
    mod.setTitle($localize`Settings: Templates`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    query.clear();
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnInit(): void {
    effect(() => {
      const args = {
        query: this.store.view.showRemotes ? '@*' : (this.store.account.origin || '*'),
        search: this.store.view.search,
        sort: [...this.store.view.sort],
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize,
        ...getTagFilter(this.store.view.filter),
      };
      defer(() => this.query.setArgs(args));
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.query.close();
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
    return this.templates.delete(template.tag + this.store.account.origin).pipe(
      switchMap(() => this.templates.create({ ...template, origin: this.store.account.origin })),
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(() => this.query.refresh());
  }
}
