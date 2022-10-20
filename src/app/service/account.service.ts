import { Injectable } from '@angular/core';
import * as _ from 'lodash-es';
import { runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, combineLatest, map, Observable, of, shareReplay, throwError } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { Ext } from '../model/ext';
import { Roles, User } from '../model/user';
import { Store } from '../store/store';
import { defaultSubs } from '../template/user';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { UserService } from './api/user.service';
import { ConfigService } from './config.service';

export const CACHE_MS = 15 * 1000;

@Injectable({
  providedIn: 'root',
})
export class AccountService {

  private _user$?: Observable<User | undefined>;
  private _userExt$?: Observable<Ext>;

  constructor(
    private store: Store,
    private config: ConfigService,
    private adminService: AdminService,
    private users: UserService,
    private exts: ExtService,
    private refs: RefService,
  ) { }

  get whoAmI$() {
    return this.users.whoAmI().pipe(
      catchError(err => {
        if ([0, 200, 403].includes(err.status)) {
          // Requires auth to access at all
          // @ts-ignore
          window.location = this.config.loginLink;
        }
        return throwError(() => err);
      }),
      tap(roles => this.store.account.setRoles(roles)),
    );
  }

  get init$() {
    if (!this.store.account.signedIn) return this.subscriptions$;
    return this.loadUserExt$.pipe(
      switchMap(() => this.user$),
      switchMap(() => this.subscriptions$),
      switchMap(() => this.bookmarks$),
      switchMap(() => this.theme$),
    )
  }

  private get loadUserExt$() {
    if (!this.store.account.signedIn) return of();
    if (!this.adminService.status.templates.user) return of();
    return this.userExt$.pipe(catchError(err => this.exts.create({ tag: this.store.account.localTag, origin: this.store.account.origin })));
  }

  clearCache() {
    this._userExt$ = undefined;
    this._user$ = undefined;
  }

  private get user$(): Observable<User | undefined> {
    if (!this.store.account.signedIn) return throwError('Not signed in');
    if (!this._user$) {
      this._user$ = this.users.get(this.store.account.tag).pipe(
        tap(user => runInAction(() => this.store.account.user = user)),
        shareReplay(1),
        catchError(() => of(undefined)),
      );
      _.delay(() => this._user$ = undefined, CACHE_MS);
    }
    return this._user$;
  }

  private get userExt$(): Observable<Ext> {
    if (!this.store.account.signedIn) return throwError('Not signed in');
    if (!this._userExt$) {
      this._userExt$ = this.exts.get(this.store.account.tag).pipe(
        tap(ext => runInAction(() => this.store.account.ext = ext)),
        shareReplay(1),
      );
      _.delay(() => this._userExt$ = undefined, CACHE_MS);
    }
    return this._userExt$;
  }

  get subscriptions$(): Observable<string[]> {
    if (!this.adminService.status.templates.user) return of(this.store.account.subs);
    return this.userExt$.pipe(
      map(ext => ext.config),
      catchError(() => of(this.adminService.status.templates.user!.defaults)),
      map(config => config?.subscriptions || []),
      tap(subs => runInAction(() => this.store.account.subs = subs)),
    );
  }

  get bookmarks$(): Observable<string[]> {
    if (!this.store.account.signedIn || !this.adminService.status.templates.user) return of([]);
    return this.userExt$.pipe(
      map(ext => ext.config?.bookmarks || []),
      tap(books => runInAction(() => this.store.account.bookmarks = books)),
    );
  }

  get theme$(): Observable<string | undefined> {
    if (!this.adminService.status.templates.user) return of(this.store.account.theme);
    if (!this.store.account.signedIn) return of(runInAction(() => this.store.account.subs = this.adminService.status.templates.user!.defaults.userTheme));
    return this.userExt$.pipe(
      map(ext => ext.config),
      catchError(() => of(this.adminService.status.templates.user!.defaults)),
      map(config => config?.userThemes?.[config.userTheme]),
      tap(css => runInAction(() => this.store.account.theme = css)),
    );
  }

  addSub(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.adminService.status.templates.user) throw 'User template not installed';
    this.exts.patch(this.store.account.tag, [{
      op: 'add',
      path: '/config/subscriptions/-',
      value: tag,
    }]).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    ).subscribe();
  }

  removeSub(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.adminService.status.templates.user) throw 'User template not installed';
    this.subscriptions$.pipe(
      map(subs => subs.indexOf(tag)),
      switchMap(index => this.exts.patch(this.store.account.tag,[{
        op: 'remove',
        path: '/config/subscriptions/' + index,
      }]))
    ).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    ).subscribe();
  }

  addBookmark(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.adminService.status.templates.user) throw 'User template not installed';
    this.exts.patch(this.store.account.tag, [{
      op: 'add',
      path: '/config/bookmarks/-',
      value: tag,
    }]).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    ).subscribe();
  }

  removeBookmark(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.adminService.status.templates.user) throw 'User template not installed';
    this.bookmarks$.pipe(
      map(subs => subs.indexOf(tag)),
      switchMap(index => this.exts.patch(this.store.account.tag,[{
        op: 'remove',
        path: '/config/bookmarks/' + index,
      }]))
    ).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    ).subscribe();
  }

  checkNotifications() {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.adminService.status.templates.user) throw 'User template not installed';
    return combineLatest(this.user$, this.userExt$).pipe(
      switchMap(([_, ext]) => this.refs.count({
        query: this.store.account.notificationsQuery,
        modifiedAfter: ext.config?.inbox?.lastNotified || moment().subtract(1, 'year'),
      })),
    ).subscribe(count => runInAction(() => this.store.account.notifications = count));
  }

  clearNotifications(readDate: moment.Moment) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.adminService.status.templates.user) throw 'User template not installed';
    this.exts.patch(this.store.account.tag, [{
      op: 'add',
      path: '/config/inbox/lastNotified',
      value: readDate.add(1, 'millisecond').toISOString(),
    }]).subscribe(() => {
      this.clearCache();
      this.checkNotifications();
    });
  }
}
