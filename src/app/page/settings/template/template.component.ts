import { HttpErrorResponse } from '@angular/common/http';
import { 
  ChangeDetectionStrategy,
  Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  selector: 'app-settings-template-page',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
})
export class SettingsTemplatePage implements OnInit, OnDestroy, HasChanges {

  serverError: string[] = [];

  @ViewChild(TemplateListComponent)
  list?: TemplateListComponent;

  private disposers: IReactionDisposer[] = [];

  constructor(
    private mod: ModService,
    public store: Store,
    public query: TemplateStore,
    private templates: TemplateService,
  ) {
    mod.setTitle($localize`Settings: Templates`);
    store.view.clear(['levels', 'tag'], ['levels', 'tag']);
    query.clear();
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = {
        query: this.store.view.showRemotes ? '@*' : (this.store.account.origin || '*'),
        search: this.store.view.search,
        sort: [...this.store.view.sort],
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize,
        ...getTagFilter(this.store.view.filter),
      };
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  upload(files?: FileList) {
    this.serverError = [];
    if (!files || !files.length) return;
    getZipOrTextFile(files[0]!, 'template.json')
      .then(json => getModels<Template>(json))
      .then(plugins => plugins.map(mapTemplate))
      .then(plugins => plugins.map(p => this.uploadTemplate(p)))
      .catch(err => this.serverError = [err]);
  }

  uploadTemplate(template: Template) {
    return this.templates.delete(template.tag + this.store.account.origin).pipe(
      switchMap(() => this.templates.create({ ...template, origin: this.store.account.origin })),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => this.query.refresh());
  }
}
