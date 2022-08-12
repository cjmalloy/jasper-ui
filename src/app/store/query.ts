import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun, makeAutoObservable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs } from '../model/ref';
import { RefService } from '../service/api/ref.service';

@Injectable({
  providedIn: 'root'
})
export class QueryStore {

  args?: RefPageArgs = {} as any;
  page?: Page<Ref> = {} as any;
  error?: HttpErrorResponse = {} as any;

  constructor(
    private refs: RefService,
  ) {
    makeAutoObservable(this);
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      this.page = undefined;
      this.error = undefined;
      if (this.args) {
        this.refs.page(this.args).pipe(
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

  setArgs(args: RefPageArgs) {
    this.args = args;
  }
}
