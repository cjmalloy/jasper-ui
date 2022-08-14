import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, autorun, makeAutoObservable, makeObservable, observable, runInAction } from 'mobx';
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
    makeObservable(this, {
      args: observable.struct,
      page: observable,
      error: observable,
      clear: action,
      setArgs: action,
    });
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      this.page = undefined;
      this.error = undefined;
      if (this.args) {
        this.exts.page(this.args).pipe(
          catchError((err: HttpErrorResponse) => {
            this.error = err;
            return throwError(() => err);
          }),
        ).subscribe(p => runInAction(() => this.page = p));
      }
    });
  }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
  }

  setArgs(args: TagPageArgs) {
    this.args = args;
  }

}
