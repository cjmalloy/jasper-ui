import { HttpErrorResponse } from '@angular/common/http';
import { effect, signal } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { printError } from '../util/http';

export type progress = (msg?: string, p?: number) => void;

export class EventBus {

  private _event = signal('');
  private _ref = signal<Ref | undefined>(undefined);
  private _repost = signal<Ref | undefined>(undefined);
  private _errors = signal<string[]>([]);
  private _progressMessages = signal<string[]>([]);
  private _progressNum = signal(0);
  private _progressDen = signal(0);

  // Debugging effect (replaces MobX reaction)
  private _debugEffect = effect(() => {
    const event = this._event();
    if (event) {
      console.log('🚌️ Event Bus:', event, event === 'error' ? this._errors() : '', this._ref());
    }
  });

  get event() { return this._event(); }
  set event(value: string) { this._event.set(value); }

  get ref() { return this._ref(); }
  set ref(value: Ref | undefined) { this._ref.set(value); }

  get repost() { return this._repost(); }
  set repost(value: Ref | undefined) { this._repost.set(value); }

  get errors() { return this._errors(); }
  set errors(value: string[]) { this._errors.set(value); }

  get progressMessages() { return this._progressMessages(); }
  set progressMessages(value: string[]) { this._progressMessages.set(value); }

  get progressNum() { return this._progressNum(); }
  set progressNum(value: number) { this._progressNum.set(value); }

  get progressDen() { return this._progressDen(); }
  set progressDen(value: number) { this._progressDen.set(value); }

  fire(event: string, ref?: Ref, repost?: Ref) {
    this._event.set(event);
    this._ref.set(ref);
    this._repost.set(repost);
  }

  fireError(errors: string[], ref?: Ref) {
    this._event.set('error');
    this._errors.set([...errors]);
    if (ref) {
      this._ref.set(ref);
    }
  }

  /**
   * Download latest revision of ref from the server and then trigger the
   * 'refresh' event.
   */
  reload(ref?: Ref) {
    this._event.set('reload');
    if (ref) {
      this._ref.set(ref);
    }
    this._repost.set(undefined);
  }

  /**
   * Notify latest version of ref is not available.
   */
  refresh(ref?: Ref) {
    this._event.set('refresh');
    if (ref) {
      this._ref.set(ref);
    }
    this._repost.set(undefined);
  }

  /**
   * Clear event bus state for sending duplicate events.
   */
  reset() {
    this._event.set('');
    this._ref.set(undefined);
    this._repost.set(undefined);
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
    return this._ref()?.url === r.url && this._ref()?.origin === r.origin;
  }

  clearProgress(steps = 0) {
    if (!steps || !this._progressDen() || this._progressNum() >= this._progressDen()) {
      this._progressMessages.set([]);
      this._progressNum.set(0);
      this._progressDen.set(steps);
    } else {
      this._progressDen.update(v => v + steps);
    }
  }

  msg(msg: string) {
    this._progressMessages.update(v => [...v, msg]);
  }

  steps(steps = 1) {
    this._progressDen.update(v => v + steps);
  }

  progress(msg?: string, steps = 1) {
    if (msg) this._progressMessages.update(v => [...v, msg]);
    if (steps) this._progressNum.update(v => v + steps);
  }
}
