import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { catchError, Observable, Subject, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { printError } from '../util/http';

export type progress = (msg?: string, p?: number) => void;
export type BusEvent = {
  event: string,
  ref?: Ref,
  repost?: Ref,
  errors: string[],
};

export class EventBus {

  readonly events = new Subject<BusEvent>();
  private readonly progressState = signal({
    messages: [] as string[],
    num: 0,
    den: 0,
  });

  get progressMessages() {
    return this.progressState().messages;
  }

  get progressNum() {
    return this.progressState().num;
  }

  get progressDen() {
    return this.progressState().den;
  }

  private setState(event: string, ref?: Ref, repost?: Ref, errors: string[] = []) {
    this.events.next({ event, ref, repost, errors });
    console.log('🚌️ Event Bus:', event, event === 'error' ? errors : '', ref);
  }

  fire(event: string, ref?: Ref, repost?: Ref) {
    this.setState(event, ref, repost);
  }

  fireError(errors: string[], ref?: Ref) {
    this.setState('error', ref, undefined, [...errors]);
  }

  /**
   * Download latest revision of ref from the server and then trigger the
   * 'refresh' event.
   */
  reload(ref?: Ref) {
    this.setState('reload', ref);
  }

  /**
   * Notify latest version of ref is not available.
   */
  refresh(ref?: Ref) {
    this.setState('refresh', ref);
  }

  /**
   * Clear event bus state for sending duplicate events.
   */
  reset() {
    this.setState('');
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

  isRef(event: BusEvent, r: Ref) {
    return event.ref?.url === r.url && event.ref.origin === r.origin;
  }

  clearProgress(steps = 0) {
    if (!steps || !this.progressDen || this.progressNum >= this.progressDen) {
      this.progressState.set({ messages: [], num: 0, den: steps });
    } else {
      this.progressState.update(progress => ({ ...progress, den: progress.den + steps }));
    }
  }

  msg(msg: string) {
    this.progressState.update(progress => ({ ...progress, messages: [...progress.messages, msg] }));
  }

  steps(steps = 1) {
    this.progressState.update(progress => ({ ...progress, den: progress.den + steps }));
  }

  progress(msg?: string, steps = 1) {
    this.progressState.update(progress => ({
      ...progress,
      messages: msg ? [...progress.messages, msg] : progress.messages,
      num: progress.num + steps,
    }));
  }
}
