import { HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Profile, ProfilePageArgs } from '../model/profile';
import { ProfileService } from '../service/api/profile.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileStore {

  private _args = signal<ProfilePageArgs | undefined>(undefined);
  private _page = signal<Page<Profile> | undefined>(undefined);
  private _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  // Backwards compatible getters/setters
  get args() { return this._args(); }
  set args(value: ProfilePageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Profile> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  // New signal-based API
  args$ = computed(() => this._args());
  page$ = computed(() => this._page());
  error$ = computed(() => this._error());

  constructor(
    private profiles: ProfileService,
  ) {
    this.clear(); // Initial values may not be null for signals
  }

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
        return throwError(() => err);
      }),
    ).subscribe(p => this.page = p);
  }

}
