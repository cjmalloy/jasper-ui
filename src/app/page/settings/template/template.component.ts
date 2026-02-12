import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  viewChild
} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-template-page',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
  imports: [TemplateListComponent],
})
export class SettingsTemplatePage implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  store = inject(Store);
  query = inject(TemplateStore);
  private templates = inject(TemplateService);


  serverError: string[] = [];

  readonly list = viewChild<TemplateListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;
    const query = this.query;

    mod.setTitle($localize`Settings: Templates`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    query.clear();
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

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
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
