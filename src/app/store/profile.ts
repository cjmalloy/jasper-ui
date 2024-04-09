import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Profile, ProfilePageArgs } from '../model/profile';
import { ProfileService } from '../service/api/profile.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileStore {

  args?: ProfilePageArgs = {} as any;
  page?: Page<Profile> = {} as any;
  error?: HttpErrorResponse = {} as any;

  constructor(
    private profiles: ProfileService,
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

  setArgs(args: ProfilePageArgs) {
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh();
  }

  refresh() {
    if (this.args) {
      this.profiles.page(this.args).pipe(
        catchError((err: HttpErrorResponse) => {
          runInAction(() => this.error = err);
          return throwError(() => err);
        }),
      ).subscribe(p => runInAction(() => this.page = p));
    }
  }

}
