import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  authError$ = new BehaviorSubject(false);

  constructor() { }

  handleHttpError(res: HttpErrorResponse) {
    if (res.status === 0) {
      this.authError$.next(true);
    }
    return throwError(res);
  }
}
