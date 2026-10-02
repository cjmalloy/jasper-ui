import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { TagPageArgs } from '../model/tag';
import { User } from '../model/user';
import { UserService } from '../service/api/user.service';

@Injectable({
  providedIn: 'root'
})
export class UserStore {

  private readonly _args = signal<TagPageArgs | undefined>(undefined, { equal: isEqual });
  private readonly _page = signal<Page<User> | undefined>(undefined);
  private readonly _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  constructor(
    private users: UserService,
  ) { }

  get args() { return this._args(); }
  set args(value: TagPageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<User> | undefined) { this._page.set(value); }

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
    this.running = this.users.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error = err;
        return EMPTY;
      }),
    ).subscribe(p => this.page = p);
  }

}
