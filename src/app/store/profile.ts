import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, EMPTY, Subscription } from 'rxjs';
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

  private running?: Subscription;

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
    if (!this.args) return;
    this.running?.unsubscribe();
    this.running = this.profiles.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return EMPTY;
      }),
    ).subscribe(p => runInAction(() => this.page = p));
  }

}
