import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { User } from '../model/user';
import { UserService } from '../service/api/user.service';

@Injectable({
  providedIn: 'root'
})
export class UserStore {

  args?: TagPageArgs = {} as any;
  page?: Page<User> = {} as any;
  error?: HttpErrorResponse = {} as any;

  constructor(
    private users: UserService,
  ) {
    makeAutoObservable(this, {
      args: observable.struct,
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
      this.users.page(this.args).pipe(
        catchError((err: HttpErrorResponse) => {
          runInAction(() => this.error = err);
          return throwError(() => err);
        }),
      ).subscribe(p => runInAction(() => this.page = p));;
    }
  }

}
