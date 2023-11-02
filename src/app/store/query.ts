import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, autorun, makeObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs } from '../model/ref';
import { RefService } from '../service/api/ref.service';

@Injectable({
  providedIn: 'root'
})
export class QueryStore {

  @observable.struct
  args?: RefPageArgs = {} as any;
  @observable.ref
  page?: Page<Ref> = {} as any;
  @observable
  error?: HttpErrorResponse;

  constructor(
    private refs: RefService,
  ) {
    makeObservable(this);
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      runInAction(() => {
        this.page = undefined;
        this.error = undefined;
      });
      if (this.args) {
        this.refs.page(this.args).pipe(
          catchError((err: HttpErrorResponse) => {
            runInAction(() => this.error = err);
            return throwError(() => err);
          }),
        ).subscribe(p => runInAction(() => this.page = p));
      }
    });
  }

  @action
  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
  }

  @action
  setArgs(args: RefPageArgs) {
    this.args = args;
  }

  @action
  refresh() {
    this.args = { ...this.args };
  }
}
