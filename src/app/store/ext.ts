import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { ExtService } from '../service/api/ext.service';

@Injectable({
  providedIn: 'root'
})
export class ExtStore {

  args?: TagPageArgs = {} as any;
  page?: Page<Ext> = {} as any;
  error?: HttpErrorResponse = {} as any;

  constructor(
    private exts: ExtService,
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
    if (this.args) {
      this.exts.page(this.args).pipe(
        catchError((err: HttpErrorResponse) => {
          runInAction(() => this.error = err);
          return throwError(() => err);
        }),
      ).subscribe(p => runInAction(() => this.page = p));
    }
  }

}
