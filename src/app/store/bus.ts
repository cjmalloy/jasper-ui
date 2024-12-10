import { HttpErrorResponse } from '@angular/common/http';
import { makeAutoObservable, observable, reaction, toJS } from 'mobx';
import { catchError, Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { printError } from '../util/http';

export type progress = (msg?: string, p?: number) => void;

export class EventBus {

  event = '';
  ref?: Ref = {} as any;
  repost?: Ref = {} as any;
  errors: string[] = [];
  progressMessages: string[] = [];
  progressNum = 0;
  progressDen = 0;

  constructor() {
    makeAutoObservable(this, {
      ref: observable.ref,
      errors: observable.shallow,
      runAndReload: false,
      runAndRefresh: false,
      catchError$: false,
      isRef: false,
    });
    reaction(() => this.event, () => console.log('🚌️ Event Bus:', this.event, this.event === 'error' ? toJS(this.errors) : '', toJS(this.ref)));
  }

  fire(event: string, ref?: Ref, repost?: Ref) {
    this.event = event;
    this.ref = ref;
    this.repost = repost;
  }

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
  refresh(ref?: Ref) {
    this.event = 'refresh';
    if (ref) {
      this.ref = ref;
    }
    this.repost = undefined;
  }

  /**
   * Clear event bus state for sending duplicate events.
   */
  reset() {
    this.event = '';
    this.ref = undefined;
    this.repost = undefined;
  }

  runAndReload(o: Observable<any>, ref?: Ref) {
    return this.runAndReload$(o, ref).subscribe();
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

  clearProgress(steps = 0) {
    if (!steps || !this.progressDen || this.progressNum >= this.progressDen) {
      this.progressMessages = [];
      this.progressNum = 0;
      this.progressDen = steps;
    } else {
      this.progressDen += steps;
    }
  }

  msg(msg: string) {
    this.progressMessages.push(msg)
  }

  steps(steps = 1) {
    this.progressDen += steps;
  }

  progress(msg?: string, steps = 1) {
    if (msg) this.progressMessages.push(msg);
    if (steps) this.progressNum += steps;
  }
}
