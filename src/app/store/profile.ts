import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { isEqual, omit } from 'lodash-es';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Profile, ProfilePageArgs } from '../model/profile';
import { ProfileService } from '../service/api/profile.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileStore {
  private profiles = inject(ProfileService);


  private _args = signal<ProfilePageArgs | undefined>(undefined);
  private _page = signal<Page<Profile> | undefined>(undefined);
  private _error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  get args() { return this._args(); }
  set args(value: ProfilePageArgs | undefined) { this._args.set(value); }

  get page() { return this._page(); }
  set page(value: Page<Profile> | undefined) { this._page.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  clear() {
    this._args.set(undefined);
    this._page.set(undefined);
    this._error.set(undefined);
  }

  setArgs(args: ProfilePageArgs) {
    if (!isEqual(omit(this._args(), 'search'), omit(args, 'search'))) this.clear();
    this._args.set(args);
    this.refresh();
  }

  refresh() {
    if (!this._args()) return;
    this.running?.unsubscribe();
    this.running = this.profiles.page(this._args()!).pipe(
      catchError((err: HttpErrorResponse) => {
        this._error.set(err);
        return throwError(() => err);
      }),
    ).subscribe(p => this._page.set(p));
  }
}
