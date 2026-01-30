import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, Subscription, throwError } from 'rxjs';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { ExtService } from '../service/api/ext.service';

@Injectable({
  providedIn: 'root'
})
export class ExtStore {

  private _args = signal<TagPageArgs | undefined>(undefined);
  private _page = signal<Page<Ext> | undefined>(undefined);
  private _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  constructor(
    private exts: ExtService,
  ) {}

  get args() { return this._args(); }
  set args(value: TagPageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Ext> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  clear() {
    this._args.set(undefined);
    this._page.set(undefined);
    this._error.set(undefined);
    this.running?.unsubscribe();
  }

  close() {
    if (this.running && !this.running.closed) this.clear();
  }

  setArgs(args: TagPageArgs) {
    if (!isEqual(omit(this._args(), 'search'), omit(args, 'search'))) this.clear();
    this._args.set(args);
    this.refresh();
  }

  refresh() {
    if (!this._args()) return;
    this.running?.unsubscribe();
    this.running = this.exts.page(this._args()!).pipe(
      catchError((err: HttpErrorResponse) => {
        this._error.set(err);
        return throwError(() => err);
      }),
    ).subscribe(p => this._page.set(p));
  }
}
