import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { Profile, ProfilePageArgs } from '../model/profile';
import { ProfileService } from '../service/api/profile.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileStore {

  private readonly _args = signal<ProfilePageArgs | undefined>(undefined, { equal: isEqual });
  private readonly _page = signal<Page<Profile> | undefined>(undefined);
  private readonly _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  constructor(
    private profiles: ProfileService,
  ) { }

  get args() { return this._args(); }
  set args(value: ProfilePageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Profile> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
  }

  setArgs(args: ProfilePageArgs) {
    if (!isEqual(omit(this.args, 'search'), omit(args, 'search'))) this.clear();
    this.args = args;
    this.refresh();
  }

  refresh() {
    if (!this.args) return;
    this.running?.unsubscribe();
    this.running = this.profiles.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error = err;
        return EMPTY;
      }),
    ).subscribe(p => this.page = p);
  }

}
