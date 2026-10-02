import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { ExtService } from '../service/api/ext.service';

@Injectable({
  providedIn: 'root'
})
export class ExtStore {

  private readonly _args = signal<TagPageArgs | undefined>(undefined, { equal: isEqual });
  private readonly _page = signal<Page<Ext> | undefined>(undefined);
  private readonly _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  constructor(
    private exts: ExtService,
  ) { }

  get args() { return this._args(); }
  set args(value: TagPageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Ext> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
    this.running?.unsubscribe();
  }

  close() {
    if (this.running && !this.running.closed) this.clear();
  }

  setArgs(args: TagPageArgs) {
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh();
  }

  refresh() {
    if (!this.args) return;
    this.running?.unsubscribe();
    this.running = this.exts.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error = err;
        return EMPTY;
      }),
    ).subscribe(p => this.page = p);
  }

}
