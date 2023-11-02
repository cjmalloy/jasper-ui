import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, autorun, makeObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Profile, ProfilePageArgs } from '../model/profile';
import { ProfileService } from '../service/api/profile.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileStore {

  @observable.struct
  args?: ProfilePageArgs = {} as any;
  @observable.ref
  page?: Page<Profile> = {} as any;
  @observable
  error?: HttpErrorResponse = {} as any;

  constructor(
    private profiles: ProfileService,
  ) {
    makeObservable(this);
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

  @action
  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
  }

  @action
  setArgs(args: ProfilePageArgs) {
    this.args = args;
  }

}
