import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { action, makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs } from '../model/ref';
import { RefService } from '../service/api/ref.service';

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

  constructor(
    private refs: RefService,
  ) {
    makeAutoObservable(this, {
      args: observable.struct,
      page: observable.ref,
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
  }

  close() {
    if (this.running && !this.running.closed) this.clear()
  }

  setArgs(args: RefPageArgs) {
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh();
  }

  refresh() {
    if (this.args) {
      this.running?.unsubscribe();
      this.running = this.refs.page(this.args).pipe(
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
}
