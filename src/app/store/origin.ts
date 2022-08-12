import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun, makeAutoObservable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Origin, OriginPageArgs } from '../model/origin';
import { Page } from '../model/page';
import { OriginService } from '../service/api/origin.service';

@Injectable({
  providedIn: 'root'
})
export class OriginStore {

  args?: OriginPageArgs = {} as any;
  page?: Page<Origin> = {} as any;
  error?: HttpErrorResponse = {} as any;

  constructor(
    private origins: OriginService,
  ) {
    makeAutoObservable(this);
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      this.page = undefined;
      this.error = undefined;
      if (this.args) {
        this.origins.page(this.args).pipe(
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

  setArgs(args: OriginPageArgs) {
    this.args = args;
  }

}
