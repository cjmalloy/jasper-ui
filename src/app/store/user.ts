import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, autorun, makeObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { User } from '../model/user';
import { UserService } from '../service/api/user.service';

@Injectable({
  providedIn: 'root'
})
export class UserStore {

  @observable.struct
  args?: TagPageArgs = {} as any;
  @observable.ref
  page?: Page<User> = {} as any;
  @observable
  error?: HttpErrorResponse = {} as any;

  constructor(
    private users: UserService,
  ) {
    makeObservable(this);
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      runInAction(() => {
        this.page = undefined;
        this.error = undefined;
      });
      if (this.args) {
        this.users.page(this.args).pipe(
          catchError((err: HttpErrorResponse) => {
            runInAction(() => this.error = err);
            return throwError(() => err);
          }),
        ).subscribe(p => runInAction(() => this.page = p));;
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
  setArgs(args: TagPageArgs) {
    this.args = args;
  }

  @action
  refresh() {
    this.args = { ...this.args };
  }

}
