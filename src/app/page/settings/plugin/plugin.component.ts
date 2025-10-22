import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, switchMap, throwError } from 'rxjs';
import { PluginListComponent } from '../../../component/plugin/plugin-list/plugin-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { mapPlugin, Plugin } from '../../../model/plugin';
import { PluginService } from '../../../service/api/plugin.service';
import { ModService } from '../../../service/mod.service';
import { PluginStore } from '../../../store/plugin';
import { Store } from '../../../store/store';
import { printError } from '../../../util/http';
import { getTagFilter } from '../../../util/query';
import { getModels, getZipOrTextFile } from '../../../util/zip';

@Component({
    selector: 'app-settings-plugin-page',
    templateUrl: './plugin.component.html',
    styleUrls: ['./plugin.component.scss'],
    imports: [PluginListComponent],
})
export class SettingsPluginPage implements OnInit, OnDestroy, HasChanges {

  serverError: string[] = [];

  @ViewChild(PluginListComponent)
  list?: PluginListComponent;

  private disposers: IReactionDisposer[] = [];

  constructor(
    private mod: ModService,
    public store: Store,
    public query: PluginStore,
    private plugins: PluginService,
  ) {
    mod.setTitle($localize`Settings: Plugins`);
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
    getZipOrTextFile(files[0]!, 'plugin.json')
      .then(json => getModels<Plugin>(json))
      .then(plugins => plugins.map(mapPlugin))
      .then(plugins => plugins.map(p => this.uploadPlugin(p)))
      .catch(err => this.serverError = [err]);
  }

  uploadPlugin(plugin: Plugin) {
    return this.plugins.delete(plugin.tag + this.store.account.origin).pipe(
      switchMap(() => this.plugins.create({ ...plugin, origin: this.store.account.origin })),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => this.query.refresh());
  }
}
