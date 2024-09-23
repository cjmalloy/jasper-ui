import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { runInAction } from 'mobx';
import { throwError } from 'rxjs';
import { Store } from '../store/store';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  constructor(
    private store: Store,
  ) { }

  handleHttpError(res: HttpErrorResponse) {
    if (navigator.onLine && this.store.account.signedIn) {
      if (res.status === 0 || res.status === 401) {
        runInAction(() => this.store.account.authError = true);
        return throwError(() => ({ message: 'Please log in again.' }));
      }
    }
    return throwError(() => res);
  }
}
