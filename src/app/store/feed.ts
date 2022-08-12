import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { autorun, makeAutoObservable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Feed } from '../model/feed';
import { Page } from '../model/page';
import { RefPageArgs } from '../model/ref';
import { FeedService } from '../service/api/feed.service';

@Injectable({
  providedIn: 'root'
})
export class FeedStore {

  args?: RefPageArgs = {} as any;
  page?: Page<Feed> = {} as any;
  error?: HttpErrorResponse = {} as any;

  constructor(
    private feeds: FeedService,
  ) {
    makeAutoObservable(this);
    this.clear(); // Initial observables may not be null for MobX
    autorun(() => {
      this.page = undefined;
      this.error = undefined;
      if (this.args) {
        this.feeds.page(this.args).pipe(
          catchError((err: HttpErrorResponse) => {
            this.error = err;
            return throwError(() => err);
          }),
        ).subscribe(p => runInAction(() => this.page = p));
      }
    });
  }

  clear() {
    this.args = undefined;
    this.page = undefined;
    this.error = undefined;
  }

  setArgs(args: RefPageArgs) {
    this.args = args;
  }

}
