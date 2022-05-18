import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  authError$ = new BehaviorSubject(false);
  loginCheck$ = new BehaviorSubject(true);

  constructor() { }

  handleHttpError(res: HttpErrorResponse) {
    if (res.status === 0) {
      this.authError$.next(true);
      return throwError({ message: 'Please log in again.' });
    }
    return throwError(res);
  }
}
