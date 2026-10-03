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

  readonly args = signal<ProfilePageArgs | undefined>(undefined, { equal: isEqual });
  readonly page = signal<Page<Profile> | undefined>(undefined);
  readonly error = signal<HttpErrorResponse | undefined>(undefined);

  private running?: Subscription;

  constructor(
    private profiles: ProfileService,
  ) { }

  clear() {
    this.args.set(undefined);
    this.page.set(undefined);
    this.error.set(undefined);
  }

  setArgs(args: ProfilePageArgs) {
    if (!isEqual(omit(this.args(), 'search'), omit(args, 'search'))) this.clear();
    this.args.set(args);
    this.refresh();
  }

  refresh() {
    const args = this.args();
    if (!args) return;
    this.running?.unsubscribe();
    this.running = this.profiles.page(args).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error.set(err);
        return EMPTY;
      }),
    ).subscribe(p => this.page.set(p));
  }

}
