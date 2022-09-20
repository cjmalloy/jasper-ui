import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Plugin } from '../../../model/plugin';
import { Template } from '../../../model/template';
import { TemplateService } from '../../../service/api/template.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { TemplateStore } from '../../../store/template';
import { printError } from '../../../util/http';
import { getModels, getZipOrTextFile } from '../../../util/zip';

@Component({
  selector: 'app-settings-template-page',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
})
export class SettingsTemplatePage implements OnInit, OnDestroy {

  serverError: string[] = [];

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: TemplateStore,
    private templates: TemplateService,
  ) {
    theme.setTitle('Settings: Templates');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = {
        search: this.store.view.search,
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize ?? this.defaultPageSize,
      };
      _.defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  upload(files?: FileList) {
    this.serverError = [];
    if (!files || !files.length) return;
    getZipOrTextFile(files[0]!, '/template.json')
      .then(json => getModels<Template>(json))
      .then(plugins => plugins.map(p => this.uploadTemplate(p)))
      .catch(err => this.serverError = [err]);
  }

  uploadTemplate(template: Template) {
    this.templates.create(template).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          return this.templates.update(template);
        }
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => this.query.refresh());
  }

  showUpload() {
    document.getElementById('upload')!.click()
  }
}
