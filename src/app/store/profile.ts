import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, autorun, makeAutoObservable, makeObservable, observable, runInAction } from 'mobx';
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
    makeObservable(this, {
      args: observable.struct,
      page: observable,
      error: observable,
      clear: action,
      setArgs: action,
    });
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      runInAction(() => {
        this.page = undefined;
        this.error = undefined;
      });
      if (this.args) {
        this.profiles.page(this.args).pipe(
          catchError((err: HttpErrorResponse) => {
            runInAction(() => this.error = err);
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

  setArgs(args: ProfilePageArgs) {
    this.args = args;
  }

}
