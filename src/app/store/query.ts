import { HttpErrorResponse } from '@angular/common/http';
import { effect, Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs } from '../model/ref';
import { RefService } from '../service/api/ref.service';

@Injectable({
  providedIn: 'root'
})
export class QueryStore {

  private _args = signal<RefPageArgs | undefined>(undefined, { equal: isEqual });
  private _sourcesOf = signal<Ref | undefined>(undefined);
  private _responseOf = signal<Ref | undefined>(undefined);
  private _page = signal<Page<Ref> | undefined>(undefined);
  private _error = signal<HttpErrorResponse | undefined>(undefined);
  private _refresh = signal(0);

  private running?: Subscription;
  private runningSources?: Subscription;
  private runningResponses?: Subscription;

  constructor(
    private refs: RefService,
  ) {
    effect(() => {
      const args = this._args();
      this._refresh(); // Track refresh signal
      if (!args) return;
      this.running?.unsubscribe();
      this.running = this.refs.page(args).pipe(
        catchError((err: HttpErrorResponse) => {
          this._error.set(err);
          return throwError(() => err);
        }),
      ).subscribe(p => this._page.set(p));
      this.runningSources?.unsubscribe();
      if (args.sources) {
        this.runningSources = this.refs.getCurrent(args.sources)
          .subscribe(ref => this._sourcesOf.set(ref));
      }
      this.runningResponses?.unsubscribe();
      if (args.responses) {
        this.runningResponses = this.refs.getCurrent(args.responses)
          .subscribe(ref => this._responseOf.set(ref));
      }
    });
  }

  get args() { return this._args(); }
  set args(value: RefPageArgs | undefined) { this._args.set(value); }

  get sourcesOf() { return this._sourcesOf(); }
  set sourcesOf(value: Ref | undefined) { this._sourcesOf.set(value); }

  get responseOf() { return this._responseOf(); }
  set responseOf(value: Ref | undefined) { this._responseOf.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Ref> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  clear() {
    this._args.set(undefined);
    this._page.set(undefined);
    this._error.set(undefined);
    this._sourcesOf.set(undefined);
    this._responseOf.set(undefined);
    this.running?.unsubscribe();
    this.runningSources?.unsubscribe();
    this.runningResponses?.unsubscribe();
  }

  close() {
    if (this.running && !this.running.closed) this.clear()
  }

  setArgs(args: RefPageArgs) {
    if (!isEqual(omit(this._args(), 'search'), omit(args, 'search'))) this.clear();
    this._args.set(args);
  }

  refresh() {
    this._refresh.update(n => n + 1);
  }
}
