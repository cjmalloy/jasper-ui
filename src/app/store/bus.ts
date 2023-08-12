import { HttpErrorResponse } from '@angular/common/http';
import { makeAutoObservable, observable, reaction, toJS } from 'mobx';
import { catchError, Observable, throwError } from 'rxjs';
import { Ref } from '../model/ref';
import { printError } from '../util/http';

export class EventBus {

  event = '';
  ref?: Ref = {} as any;
  errors: string[] = [];

  constructor() {
    makeAutoObservable(this, {
      ref: observable.shallow,
      errors: observable.shallow,
      runAndReload: false,
      runAndRefresh: false,
      catchError: false,
      isRef: false,
    });
    reaction(() => this.event, () => console.log('🚌️ Event Bus:', this.event, this.event === 'error' ? toJS(this.errors) : '', toJS(this.ref)));
  }

  fire(event: string, ref?: Ref) {
    this.event = event;
    this.ref = ref;
  }

  fireError(errors: string[], ref?: Ref) {
    this.event = 'error';
    this.errors = [...errors];
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

  runAndRefresh(o: Observable<any>, ref?: Ref) {
    this.catchError(o, ref).subscribe(() => this.refresh(ref));
  }

  catchError(o: Observable<any>, ref?: Ref) {
    return o.pipe(
      catchError((err: HttpErrorResponse) => {
        this.fireError(printError(err), ref);
        return throwError(() => err);
      })
    );
  }

  isRef(r: Ref) {
    return this.ref?.url === r.url && this.ref.origin === r.origin;
  }
}
