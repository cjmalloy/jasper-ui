import { HttpErrorResponse } from '@angular/common/http';
import { action, makeObservable, observable, reaction, toJS } from 'mobx';
import { catchError, Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { printError } from '../util/http';

export class EventBus {

  @observable
  event = '';
  @observable.ref
  ref?: Ref = {} as any;
  @observable
  repost?: Ref = {} as any;
  @observable.shallow
  errors: string[] = [];

  constructor() {
    makeObservable(this);
    reaction(() => this.event, () => console.log('🚌️ Event Bus:', this.event, this.event === 'error' ? toJS(this.errors) : '', toJS(this.ref)));
  }

  @action
  fire(event: string, ref?: Ref, repost?: Ref) {
    this.event = event;
    this.ref = ref;
    this.repost = repost;
  }

  @action
  fireError(errors: string[], ref?: Ref) {
    this.event = 'error';
    this.errors = [...errors];
    if (ref) {
      this.ref = ref;
    }
  }

  /**
   * Download latest revision of ref from the server and then trigger the
   * 'refresh' event.
   */
  @action
  reload(ref?: Ref) {
    this.event = 'reload';
    if (ref) {
      this.ref = ref;
    }
    this.repost = undefined;
  }

  /**
   * Notify latest version of ref is not available.
   */
  @action
  refresh(ref?: Ref) {
    this.event = 'refresh';
    if (ref) {
      this.ref = ref;
    }
    this.repost = undefined;
  }

  runAndReload(o: Observable<any>, ref?: Ref) {
    this.runAndReload$(o, ref).subscribe();
  }

  runAndReload$(o: Observable<any>, ref?: Ref) {
    return this.catchError$(o, ref).pipe(tap(() => this.reload(ref)));
  }

  runAndRefresh(o: Observable<any>, ref?: Ref) {
    this.runAndRefresh$(o, ref).subscribe();
  }

  runAndRefresh$(o: Observable<any>, ref?: Ref) {
    return this.catchError$(o, ref).pipe(tap(() => this.refresh(ref)));
  }

  catchError$(o: Observable<any>, ref?: Ref) {
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
