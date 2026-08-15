import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { action, makeAutoObservable, observableRef, observableStruct, runInAction } from 'mobx';
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

  args?: RefPageArgs = {} as any;
  sourcesOf?: Ref = {} as any;
  responseOf?: Ref = {} as any;
  page?: Page<Ref> = {} as any;
  error?: HttpErrorResponse = {} as any;

  private running?: Subscription;
  private runningSources?: Subscription;
  private runningResponses?: Subscription;
  private pendingCursor?: PendingCursor;

  constructor(
    private refs: RefService,
  ) {
    makeAutoObservable(this, {
      args: observableStruct,
      page: observableRef,
      clear: action,
    });
    this.clear(); // Initial observables may not be null for MobX
  }

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
      ).subscribe(ref => runInAction(() => this.sourcesOf = ref));
    } else {
      this.sourcesOf = undefined;
    }
    this.runningResponses?.unsubscribe();
    if (args.responses) {
      this.runningResponses = this.refs.getCurrent(args.responses).pipe(
        catchError(() => EMPTY),
      ).subscribe(ref => runInAction(() => this.responseOf = ref));
    } else {
      this.responseOf = undefined;
    }
  }

  refresh(pageRequest?: Observable<Page<Ref>>) {
    if (this.args) {
      this.running?.unsubscribe();
      this.running = (pageRequest ?? this.refs.page(withStableDateSort(this.args))).pipe(
        catchError((err: HttpErrorResponse) => {
          runInAction(() => this.error = err);
          return EMPTY;
        }),
      ).subscribe(p => runInAction(() => this.page = p));
      this.runningSources?.unsubscribe();
      if (this.args.sources) {
        this.runningSources = this.refs.getCurrent(this.args.sources).pipe(
          catchError(() => EMPTY),
        ).subscribe(ref => runInAction(() => this.sourcesOf = ref));
      }
      this.runningResponses?.unsubscribe();
      if (this.args.responses) {
        this.runningResponses = this.refs.getCurrent(this.args.responses).pipe(
          catchError(() => EMPTY),
        ).subscribe(ref => runInAction(() => this.responseOf = ref));
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
