import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, EMPTY, Observable, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { withStableDateSort } from '../util/query';

interface PendingCursor {
  args: RefPageArgs;
  target: number;
  request: Observable<Page<Ref>>;
}

@Injectable({
  providedIn: 'root'
})
export class QueryStore {

  private readonly _args = signal<RefPageArgs | undefined>(undefined, { equal: isEqual });
  private readonly _sourcesOf = signal<Ref | undefined>(undefined);
  private readonly _responseOf = signal<Ref | undefined>(undefined);
  private readonly _page = signal<Page<Ref> | undefined>(undefined);
  private readonly _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;
  private runningSources?: Subscription;
  private runningResponses?: Subscription;
  private pendingCursor?: PendingCursor;

  constructor(
    private refs: RefService,
  ) { }

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
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
    this.sourcesOf = undefined;
    this.responseOf = undefined;
    this.running?.unsubscribe();
    this.runningSources?.unsubscribe();
    this.runningResponses?.unsubscribe();
    this.pendingCursor = undefined;
  }

  close() {
    this.pendingCursor = undefined;
    if (this.running && !this.running.closed) this.clear()
  }

  setArgs(args: RefPageArgs) {
    const cursorRequest = this.takeCursor(args);
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh(cursorRequest);
  }

  queueCursorPage(target: number, request: Observable<Page<Ref>>) {
    if (!this.args) return;
    this.pendingCursor = {
      args: { ...this.args },
      target,
      request,
    };
  }

  setRelatedArgs(args: RefPageArgs) {
    this.pendingCursor = undefined;
    this.args = args;
    this.runningSources?.unsubscribe();
    if (args.sources) {
      this.runningSources = this.refs.getCurrent(args.sources).pipe(
        catchError(() => EMPTY),
      ).subscribe(ref => this.sourcesOf = ref);
    } else {
      this.sourcesOf = undefined;
    }
    this.runningResponses?.unsubscribe();
    if (args.responses) {
      this.runningResponses = this.refs.getCurrent(args.responses).pipe(
        catchError(() => EMPTY),
      ).subscribe(ref => this.responseOf = ref);
    } else {
      this.responseOf = undefined;
    }
  }

  refresh(pageRequest?: Observable<Page<Ref>>) {
    if (this.args) {
      this.running?.unsubscribe();
      this.running = (pageRequest ?? this.refs.page(withStableDateSort(this.args))).pipe(
        catchError((err: HttpErrorResponse) => {
          this.error = err;
          return EMPTY;
        }),
      ).subscribe(p => this.page = p);
      this.runningSources?.unsubscribe();
      if (this.args.sources) {
        this.runningSources = this.refs.getCurrent(this.args.sources).pipe(
          catchError(() => EMPTY),
        ).subscribe(ref => this.sourcesOf = ref);
      }
      this.runningResponses?.unsubscribe();
      if (this.args.responses) {
        this.runningResponses = this.refs.getCurrent(this.args.responses).pipe(
          catchError(() => EMPTY),
        ).subscribe(ref => this.responseOf = ref);
      }
    }
  }

  private takeCursor(args: RefPageArgs): Observable<Page<Ref>> | undefined {
    const pending = this.pendingCursor;
    this.pendingCursor = undefined;
    if (pending?.target !== Number(args.page)) return undefined;
    if (!isEqual(
      omit(pending.args, 'page', 'obsolete'),
      omit(args, 'page', 'obsolete'),
    )) return undefined;
    return pending.request;
  }
}
