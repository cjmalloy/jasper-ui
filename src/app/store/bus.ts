import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, Injectable, signal } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { printError } from '../util/http';

export type progress = (msg?: string, p?: number) => void;

@Injectable({
  providedIn: 'root'
})
export class EventBus {

  private _event = signal('');
  private _ref = signal<Ref | undefined>({} as any);
  private _repost = signal<Ref | undefined>({} as any);
  private _errors = signal<string[]>([]);
  private _progressMessages = signal<string[]>([]);
  private _progressNum = signal(0);
  private _progressDen = signal(0);

  // Backwards compatible getters/setters
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

  // New signal-based API
  event$ = computed(() => this._event());
  ref$ = computed(() => this._ref());
  repost$ = computed(() => this._repost());
  errors$ = computed(() => this._errors());
  progressMessages$ = computed(() => this._progressMessages());
  progressNum$ = computed(() => this._progressNum());
  progressDen$ = computed(() => this._progressDen());

  constructor() {
    // Replace MobX reaction with Angular effect
    effect(() => {
      const event = this._event();
      const ref = this._ref();
      const errors = this._errors();
      console.log('🚌️ Event Bus:', event, event === 'error' ? errors : '', ref);
    });
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
