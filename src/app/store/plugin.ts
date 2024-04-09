import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Plugin } from '../model/plugin';
import { TagPageArgs } from '../model/tag';
import { PluginService } from '../service/api/plugin.service';

@Injectable({
  providedIn: 'root'
})
export class PluginStore {

  args?: TagPageArgs = {} as any;
  page?: Page<Plugin> = {} as any;
  error?: HttpErrorResponse = {} as any;

  constructor(
    private plugins: PluginService,
  ) {
    makeAutoObservable(this, {
      args: observable.struct,
      page: observable.ref,
    });
    this.clear(); // Initial observables may not be null for MobX
  }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
  }

  setArgs(args: TagPageArgs) {
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh();
  }

  refresh() {
    this.plugins.page(this.args || {}).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return throwError(() => err);
      }),
    ).subscribe(p => runInAction(() => this.page = p));

  }

}
