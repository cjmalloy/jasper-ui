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
    if (this.store.account.signedIn && res.status === 0) {
      runInAction(() => this.store.account.authError = true);
      return throwError({ message: 'Please log in again.' });
    }
    return throwError(res);
  }
}
