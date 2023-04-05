import { HttpErrorResponse } from '@angular/common/http';
import { makeAutoObservable, observable } from 'mobx';
import { catchError, Observable, throwError } from 'rxjs';
import { Ref } from '../model/ref';
import { printError } from '../util/http';

export class EventBus {

  event = '';
  ref: Ref = {} as any;
  errors: string[] = [];

  constructor() {
    makeAutoObservable(this, {
      ref: observable.shallow,
      runAndReload: false,
    });
  }

  fire(event: string, ref: Ref) {
    this.event = event;
    this.ref = ref;
  }

  fireError(errors: string[], ref?: Ref) {
    this.event = 'error';
    this.errors = errors;
    if (ref) {
      this.ref = ref;
    }
  }

  reload(ref?: Ref) {
    this.event = 'reload';
    if (ref) {
      this.ref = ref;
    }
  }

  refresh(ref?: Ref) {
    this.event = 'refresh';
    if (ref) {
      this.ref = ref;
    }
  }

  runAndReload(o: Observable<any>, ref?: Ref) {
    this.catchError(o, ref).subscribe(() => this.reload(ref));
  }

  catchError(o: Observable<any>, ref?: Ref) {
    return o.pipe(
      catchError((err: HttpErrorResponse) => {
        this.fireError(printError(err), ref);
        return throwError(() => err);
      })
    );
  }
}
