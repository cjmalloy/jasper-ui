import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { throwError } from 'rxjs';
import { Store } from '../store/store';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private config = inject(ConfigService);
  private store = inject(Store);


  handleHttpError(res: HttpErrorResponse) {
    if (!this.config.electron && navigator.onLine && this.store.account.signedIn()) {
      if (res.status === 401) {
        this.store.account.authError.set(true);
        return throwError(() => ({ message: 'Please log in again.' }));
      }
    }
    return throwError(() => res);
  }
}
