import { Injectable } from '@angular/core';
import { delay, isArray, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
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
          this.config.logIn();
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
    // Initialize selected user tag from localStorage
    this.initSelectedUserTag();
    
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
    this.addConfigArray$('subscriptions', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    ).subscribe();
  }

  removeSub(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.subscriptions$.pipe(
      switchMap(() => this.removeConfigArray$('subscriptions', tag)),
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    ).subscribe();
  }

  addBookmark(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.addConfigArray$('bookmarks', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    ).subscribe();
  }

  removeBookmark(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.bookmarks$.pipe(
      switchMap(() => this.removeConfigArray$('bookmarks', tag)),
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    ).subscribe();
  }

  addAlarm(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.addConfigArray$('alarms', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.alarms$),
    ).subscribe();
  }

  removeAlarm(tag: string) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.alarms$.pipe(
      switchMap(() => this.removeConfigArray$('alarms', tag)),
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
        modifiedAfter: this.store.account.config.lastNotified || DateTime.now().minus({ year: 1 }),
      })),
    ).subscribe(count => runInAction(() => this.store.account.notifications = count));
    this.checkAlarms();
  }

  clearNotificationsIfNone(readDate?: DateTime) {
    if (!readDate || this.store.account.config.lastNotified && readDate < DateTime.fromISO(this.store.account.config.lastNotified)) return;
    if (!this.store.account.signedIn) return;
    if (!this.admin.getTemplate('user')) return;
    this.userExt$.pipe(
      switchMap(() => this.refs.count({
        query: this.store.account.notificationsQuery,
        modifiedAfter: this.store.account.config.lastNotified || DateTime.now().minus({year: 1}),
        modifiedBefore: readDate,
      })),
    ).subscribe(count => {
      if (count === 0) {
        this.clearNotifications(readDate);
      } else {
        runInAction(() => this.store.account.ignoreNotifications.push(readDate.valueOf()));
      }
    });
  }

  clearNotifications(readDate?: DateTime) {
    if (readDate) {
      if (this.store.account.config.lastNotified && readDate < DateTime.fromISO(this.store.account.config.lastNotified)) return;
    } else {
      readDate = DateTime.now();
    }
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    const lastNotified = readDate.plus({ millisecond: 1 }).toISO();
    this.updateConfig$('lastNotified', lastNotified).subscribe(() => {
      this.clearCache();
      this.checkNotifications();
    });
  }

  checkAlarms() {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    if (!this.store.account.alarms.length) return;
    this.userExt$.pipe(
      switchMap(() => this.refs.count({
        query: this.store.account.alarmsQuery,
        modifiedAfter: this.store.account.config.lastNotified || DateTime.now().minus({ year: 1 }),
      })),
    ).subscribe(count => runInAction(() => this.store.account.alarmCount = count));
  }

  checkConsent(consent?: [string, string][]) {
    if (!consent?.length) return;
    let status = this.store.account.ext?.config?.consent || {};
    let result = null;
    for (const [key, disclosure] of consent) {
      if (!status?.[key] && confirm(disclosure)) {
        result ||= { ...status };
        result[key] = true;
      }
    }
    if (result) {
      this.userExt$.pipe(
        switchMap(() => this.updateConfig$('consent', result)),
      ).subscribe();
    }
  }

  // TODO: move to ext, plugin, template service as  a mixin
  updateConfig$(name: keyof UserConfig, value: any) {
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
          modified: DateTime.fromISO(cursor),
          modifiedString: cursor,
        };
      })));
  }

  addConfigArray$(name: keyof UserConfig, value: any) {
    let path = name;
    if (!this.store.account.config[name]) {
      value = [value];
    } else {
      if ((this.store.account.config[name] as any[]).includes(value)) return of();
      path += '/-';
    }
    return this.exts.patch(this.store.account.tag, this.store.account.ext!.modifiedString!, [{
        op: 'add',
        path: '/config/' + path,
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
          modified: DateTime.fromISO(cursor),
          modifiedString: cursor,
        };
      })));
  }

  removeConfigArray$(name: keyof UserConfig, value: any) {
    if (!isArray(this.store.account.config[name])) return of();
    const index = (this.store.account.config[name] as any[]).indexOf(value);
    if (index === -1) return of();
    return this.exts.patch(this.store.account.tag, this.store.account.ext!.modifiedString!, [{
      op: 'remove',
      path: '/config/' + name + '/' + index,
    }]).pipe(tap(cursor => runInAction(() => {
        this.store.account.ext = <Ext> {
          ...this.store.account.ext,
          config: {
            ...this.store.account.config,
            [name]: without(this.store.account.config[name] as any[], value)
          },
          modified: DateTime.fromISO(cursor),
          modifiedString: cursor,
        };
      })));
  }

  /**
   * Set the selected user tag and save to localStorage
   */
  setSelectedUserTag(tag: string) {
    try {
      this.store.account.setSelectedUserTag(tag);
      this.store.local.selectedUserTag = tag;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clear the selected user tag
   */
  clearSelectedUserTag() {
    this.store.account.clearSelectedUserTag();
    this.store.local.selectedUserTag = '';
  }

  /**
   * Initialize selected user tag from localStorage
   */
  initSelectedUserTag() {
    const savedTag = this.store.local.selectedUserTag;
    if (savedTag && this.store.account.isValidSubTag(savedTag)) {
      this.store.account.selectedUserTag = savedTag;
    }
  }
}
