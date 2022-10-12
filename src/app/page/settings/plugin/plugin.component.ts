import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Plugin } from '../../../model/plugin';
import { PluginService } from '../../../service/api/plugin.service';
import { ThemeService } from '../../../service/theme.service';
import { PluginStore } from '../../../store/plugin';
import { Store } from '../../../store/store';
import { printError } from '../../../util/http';
import { getModels, getZipOrTextFile } from '../../../util/zip';

@Component({
  selector: 'app-settings-plugin-page',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss'],
})
export class SettingsPluginPage implements OnInit, OnDestroy {

  serverError: string[] = [];

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public store: Store,
    public query: PluginStore,
    private plugins: PluginService,
  ) {
    theme.setTitle('Settings: Plugins');
    store.view.clear();
    store.view.defaultSort = 'modified';
    store.view.defaultSearchSort = 'tag';
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = {
        search: this.store.view.search,
        sort: this.store.view.sort,
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
    getZipOrTextFile(files[0]!, '/plugin.json')
      .then(json => getModels<Plugin>(json))
      .then(plugins => plugins.map(p => this.uploadPlugin(p)))
      .catch(err => this.serverError = [err]);
  }

  uploadPlugin(plugin: Plugin) {
    this.plugins.create(plugin).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          return this.plugins.update(plugin);
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
