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

  readonly args = signal<RefPageArgs | undefined>(undefined, { equal: isEqual });
  readonly sourcesOf = signal<Ref | undefined>(undefined);
  readonly responseOf = signal<Ref | undefined>(undefined);
  readonly page = signal<Page<Ref> | undefined>(undefined);
  readonly error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;
  private runningSources?: Subscription;
  private runningResponses?: Subscription;
  private pendingCursor?: PendingCursor;

  constructor(
    private refs: RefService,
  ) { }

  clear() {
    this.args.set(undefined);
    this.page.set(undefined);
    this.error.set(undefined);
    this.sourcesOf.set(undefined);
    this.responseOf.set(undefined);
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
    if (!isEqual(omit(this.args(), 'search'), omit(args, 'search'))) this.clear();
    this.args.set(args);
    this.refresh(cursorRequest);
  }

  queueCursorPage(target: number, request: Observable<Page<Ref>>) {
    if (!this.args()) return;
    this.pendingCursor = {
      args: { ...this.args() },
      target,
      request,
    };
  }

  setRelatedArgs(args: RefPageArgs) {
    this.pendingCursor = undefined;
    this.args.set(args);
    this.runningSources?.unsubscribe();
    if (args.sources) {
      this.runningSources = this.refs.getCurrent(args.sources).pipe(
        catchError(() => EMPTY),
      ).subscribe(ref => this.sourcesOf.set(ref));
    } else {
      this.sourcesOf.set(undefined);
    }
    this.runningResponses?.unsubscribe();
    if (args.responses) {
      this.runningResponses = this.refs.getCurrent(args.responses).pipe(
        catchError(() => EMPTY),
      ).subscribe(ref => this.responseOf.set(ref));
    } else {
      this.responseOf.set(undefined);
    }
  }

  refresh(pageRequest?: Observable<Page<Ref>>) {
    const args = this.args();
    if (args) {
      this.running?.unsubscribe();
      this.running = (pageRequest ?? this.refs.page(withStableDateSort(args))).pipe(
        catchError((err: HttpErrorResponse) => {
          this.error.set(err);
          return EMPTY;
        }),
      ).subscribe(p => this.page.set(p));
      this.runningSources?.unsubscribe();
      if (args.sources) {
        this.runningSources = this.refs.getCurrent(args.sources).pipe(
          catchError(() => EMPTY),
        ).subscribe(ref => this.sourcesOf.set(ref));
      }
      this.runningResponses?.unsubscribe();
      if (args.responses) {
        this.runningResponses = this.refs.getCurrent(args.responses).pipe(
          catchError(() => EMPTY),
        ).subscribe(ref => this.responseOf.set(ref));
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
