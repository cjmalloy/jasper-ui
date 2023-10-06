import { Injectable } from '@angular/core';
import { delay, uniq } from 'lodash-es';
import { runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, forkJoin, map, Observable, of, shareReplay, throwError } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { Ext } from '../model/ext';
import { User } from '../model/user';
import { UserConfig } from '../mods/user';
import { Store } from '../store/store';
import { hasPrefix } from '../util/tag';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { UserService } from './api/user.service';
import { AuthnService } from './authn.service';

export const CACHE_MS = 15 * 1000;

@Injectable({
  providedIn: 'root',
})
export class AccountService {

  private _user$?: Observable<User | undefined>;
  private _userExt$?: Observable<Ext>;

  constructor(
    private store: Store,
    private authn: AuthnService,
    private admin: AdminService,
    private users: UserService,
    private exts: ExtService,
    private refs: RefService,
  ) { }

  get whoAmI$() {
    return this.users.whoAmI().pipe(
      catchError(err => {
        if ([0, 200, 401, 403].includes(err.status)) {
          // Requires auth to access at all
          this.authn.logIn();
        }
        return throwError(() => err);
      }),
      tap(roles => this.store.account.setRoles(roles)),
    );
  }

  get initExt$() {
    return this.userExt$.pipe(catchError(() => of(null)));
  }

  get init$() {
    runInAction(() => this.store.account.defaultConfig = this.admin.defaultConfig('user'));
    if (!this.store.account.signedIn) return this.subscriptions$.pipe(
      switchMap(() => this.bookmarks$),
      switchMap(() => this.theme$),
    );
    return this.loadUserExt$.pipe(
      switchMap(() => this.user$),
      switchMap(() => this.subscriptions$),
      switchMap(() => this.bookmarks$),
      switchMap(() => this.theme$),
      catchError(err => {
        console.error('Can not create user data');
        console.error(err);
        return of(null);
      }),
    );
  }

  private get loadUserExt$() {
    if (!this.store.account.signedIn) return of(undefined);
    if (!this.admin.getTemplate('user')) return of(undefined);
    return this.userExt$.pipe(
      catchError(() => of(undefined)),
      switchMap(ext => ext ? of(ext) : this.exts.create({ tag: this.store.account.localTag, origin: this.store.account.origin })),
      map(() => {}),
    );
  }

  clearCache() {
    this._userExt$ = undefined;
    this._user$ = undefined;
  }

  private get user$(): Observable<User | undefined> {
    if (!this.store.account.signedIn) return throwError(() => 'Not signed in');
    if (!this._user$) {
      this._user$ = this.users.get(this.store.account.tag).pipe(
        tap(user => runInAction(() => this.store.account.access = user)),
        shareReplay(1),
        catchError(() => of(undefined)),
      );
      delay(() => this._user$ = undefined, CACHE_MS);
    }
    return this._user$;
  }

  private get userExt$(): Observable<Ext> {
    if (!this.store.account.signedIn) return throwError(() => 'Not signed in');
    if (!this._userExt$) {
      this._userExt$ = this.exts.get(this.store.account.tag).pipe(
        tap(ext => runInAction(() => this.store.account.ext = ext)),
        shareReplay(1),
      );
      delay(() => this._userExt$ = undefined, CACHE_MS);
    }
    return this._userExt$;
  }

  get forYouQuery$(): Observable<string> {
    const followers = this.store.account.userSubs
      .map(u => this.exts.getCachedExt(u));
    return (followers.length ? forkJoin(followers) : of([])).pipe(
      map(es => [
          ...this.store.account.tagSubs,
        ...es
          .flatMap(e => e?.config?.subscriptions)
          .filter(s => !!s)
          .filter(s => !hasPrefix(s, 'user'))
      ]),
      map(uniq),
      map(es => es.length === 0 ? 'none' : '!internal:(' + es.join('|') + ')'),
    );
  }

  get subscriptions$(): Observable<string[]> {
    if (!this.admin.getTemplate('user')) return of(this.store.account.subs);
    return this.userExt$.pipe(
      catchError(() => of(null)),
      map(() => this.store.account.subs),
    );
  }

  get bookmarks$(): Observable<string[]> {
    if (!this.admin.getTemplate('user')) return of(this.store.account.bookmarks);
    return this.userExt$.pipe(
      catchError(() => of(null)),
      map(() => this.store.account.bookmarks),
    );
  }

  get alarms$(): Observable<string[]> {
    if (!this.admin.getTemplate('user')) return of(this.store.account.alarms);
    return this.userExt$.pipe(
      catchError(() => of(null)),
      map(() => this.store.account.alarms),
    );
  }

  get theme$(): Observable<string | undefined> {
    if (!this.admin.getTemplate('user')) return of(this.store.account.config.theme);
    return this.userExt$.pipe(
      catchError(() => of(null)),
      map(() => this.store.account.config.theme),
    );
  }

  addSub(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.addConfigArray('subscriptions', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    ).subscribe();
  }

  removeSub(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.subscriptions$.pipe(
      map(subs => subs.indexOf(tag)),
      switchMap(index => this.removeConfigArray('subscriptions', index)),
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    ).subscribe();
  }

  addBookmark(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.addConfigArray('bookmarks', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    ).subscribe();
  }

  removeBookmark(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.bookmarks$.pipe(
      map(subs => subs.indexOf(tag)),
      switchMap(index => this.removeConfigArray('bookmarks', index)),
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    ).subscribe();
  }

  addAlarm(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.addConfigArray('alarms', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.alarms$),
    ).subscribe();
  }

  removeAlarm(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.alarms$.pipe(
      map(subs => subs.indexOf(tag)),
      switchMap(index => this.removeConfigArray('alarms', index)),
      tap(() => this.clearCache()),
      switchMap(() => this.alarms$),
    ).subscribe();
  }

  checkNotifications() {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.userExt$.pipe(
      switchMap(() => this.refs.count({
        query: this.store.account.notificationsQuery,
        modifiedAfter: this.store.account.config.lastNotified || moment().subtract(1, 'year'),
      })),
    ).subscribe(count => runInAction(() => this.store.account.notifications = count));
  }

  clearNotifications(readDate: moment.Moment) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    const lastNotified = readDate.add(1, 'millisecond').toISOString();
    this.updateConfig('lastNotified', lastNotified).subscribe(() => {
      this.clearCache();
      this.checkNotifications();
    });
  }

  updateConfig(name: string, value: any) {
    return this.exts.patch(this.store.account.tag, this.store.account.ext!.modifiedString!, [{
        op: 'add',
        path: '/config/' + name,
        value: value,
      }]).pipe(tap(cursor => runInAction(() => {
        this.store.account.ext = <Ext> {
          ...this.store.account.ext,
          config: {
            ...this.store.account.config,
            [name]: value,
          },
          modified: moment(cursor),
          modifiedString: cursor,
        };
      })));
  }

  addConfigArray(name: keyof UserConfig, value: any) {
    if (!this.store.account.config[name]) {
      value = [value];
    } else {
      name += '/-';
    }
    return this.exts.patch(this.store.account.tag, this.store.account.ext!.modifiedString!, [{
        op: 'add',
        path: '/config/' + name,
        value: value,
      }]).pipe(tap(cursor => runInAction(() => {
        this.store.account.ext = <Ext> {
          ...this.store.account.ext,
          config: {
            ...this.store.account.config,
            [name]: [
              ...(this.store.account.config[name] as any[] || []),
              value
            ],
          },
          modified: moment(cursor),
          modifiedString: cursor,
        };
      })));
  }

  removeConfigArray(name: keyof UserConfig, index: number) {
    return this.exts.patch(this.store.account.tag, this.store.account.ext!.modifiedString!, [{
      op: 'remove',
      path: '/config/' + name + '/' + index,
    }]).pipe(tap(cursor => runInAction(() => {
        this.store.account.ext = <Ext> {
          ...this.store.account.ext,
          config: {
            ...this.store.account.config,
            [name]: (this.store.account.config[name] as any[] || []).splice(index, 1),
          },
          modified: moment(cursor),
          modifiedString: cursor,
        };
      })));
  }
}
