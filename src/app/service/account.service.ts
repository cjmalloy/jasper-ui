import { Injectable } from '@angular/core';
import { delay, isArray, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
import { catchError, finalize, forkJoin, map, Observable, of, shareReplay, throwError } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { User } from '../model/user';
import { cursorSettingsUrl, getMailbox } from '../mods/mailbox';
import { UserConfig } from '../mods/user';
import { Store } from '../store/store';
import { escapePath } from '../util/json-patch';
import { hasPrefix, localTag, tagOrigin } from '../util/tag';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { TaggingService } from './api/tagging.service';
import { UserService } from './api/user.service';
import { ConfigService } from './config.service';
import { OriginMapService } from './origin-map.service';

export const CACHE_MS = 15 * 1000;
const CURSOR_PLUGIN = 'plugin/user/cursor';

export interface NotificationStream {
  origin: string;
  query: string;
  settingsUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class AccountService {

  private _user$?: Observable<User | undefined>;
  private _userExt$?: Observable<Ext>;
  private _notificationCursors$?: Observable<NotificationStream[]>;
  private cursorAccount = '';
  private cursorRefs = new Map<string, Ref | undefined>();

  constructor(
    private store: Store,
    private config: ConfigService,
    private admin: AdminService,
    private users: UserService,
    private exts: ExtService,
    private refs: RefService,
    private tags: TaggingService,
    private origins: OriginMapService,
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

  addSub$(tag: string): Observable<any> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    return this.addConfigArray$('subscriptions', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    );
  }

  removeSub$(tag: string): Observable<any> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    return this.subscriptions$.pipe(
      switchMap(() => this.removeConfigArray$('subscriptions', tag)),
      tap(() => this.clearCache()),
      switchMap(() => this.subscriptions$),
    );
  }

  addBookmark$(tag: string): Observable<any> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    return this.addConfigArray$('bookmarks', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    );
  }

  removeBookmark$(tag: string): Observable<any> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    return this.bookmarks$.pipe(
      switchMap(() => this.removeConfigArray$('bookmarks', tag)),
      tap(() => this.clearCache()),
      switchMap(() => this.bookmarks$),
    );
  }

  addAlarm$(tag: string): Observable<any> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    return this.addConfigArray$('alarms', tag).pipe(
      tap(() => this.clearCache()),
      switchMap(() => this.alarms$),
    );
  }

  removeAlarm$(tag: string): Observable<any> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    return this.alarms$.pipe(
      switchMap(() => this.removeConfigArray$('alarms', tag)),
      tap(() => this.clearCache()),
      switchMap(() => this.alarms$),
    );
  }

  checkNotifications() {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.loadNotificationCursors$().pipe(
      switchMap(streams => forkJoin(streams.map(stream => this.refs.count({
        query: stream.query,
        modifiedAfter: this.store.account.notificationCursors.get(stream.origin),
      })))),
    ).subscribe(counts => {
      runInAction(() =>
        this.store.account.notifications = counts.reduce((sum, count) => sum + count, 0));
      this.checkAlarms();
    });
  }

  notificationPage$(size: number): Observable<Page<Ref>> {
    return this.loadNotificationCursors$().pipe(
      switchMap(streams => forkJoin(streams.map(stream => this.refs.page({
        query: stream.query,
        modifiedAfter: this.store.account.notificationCursors.get(stream.origin),
        sort: ['modified,ASC'],
        size,
      })))),
      map(pages => {
        const content = pages
          .flatMap(page => page.content)
          .sort((a, b) => a.modified!.valueOf() - b.modified!.valueOf())
          .slice(0, size);
        const page = Page.of(content);
        page.page.totalElements = pages.reduce((sum, result) => sum + result.page.totalElements, 0);
        page.page.totalPages = Math.ceil(page.page.totalElements / size);
        page.page.size = size;
        return page;
      }),
    );
  }

  clearNotificationsIfNone(readDate?: DateTime) {
    if (!readDate) return;
    if (!this.store.account.signedIn) return;
    if (!this.admin.getTemplate('user')) return;
    this.loadNotificationCursors$().pipe(
      switchMap(streams => forkJoin(streams.map(stream => this.refs.count({
        query: stream.query,
        modifiedAfter: this.store.account.notificationCursors.get(stream.origin),
        modifiedBefore: readDate,
      }).pipe(map(count => ({ stream, count })))))),
    ).subscribe(results => {
      const empty = results.filter(result => result.count === 0).map(result => result.stream.origin);
      if (empty.length) this.clearNotifications(readDate, empty);
      if (results.some(result => result.count !== 0)) {
        runInAction(() => this.store.account.ignoreNotifications.push(readDate.valueOf()));
      }
    });
  }

  clearNotifications(readDate: DateTime = DateTime.now(), origins?: string[]) {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    const cursor = readDate.plus({ millisecond: 1 }).toISO()!;
    this.loadNotificationCursors$().pipe(
      switchMap(streams => forkJoin(streams
        .filter(stream => !origins || origins.includes(stream.origin))
        .filter(stream => {
          const current = this.store.account.notificationCursors.get(stream.origin);
          return !current || readDate.plus({ millisecond: 1 }) > DateTime.fromISO(current);
        })
        .map(stream => this.writeNotificationCursor$(stream, cursor)))),
    ).subscribe(() => {
      this.checkNotifications();
    });
  }

  checkAlarms() {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    if (!this.store.account.alarms.length) return;
    this.loadNotificationCursors$().pipe(
      switchMap(streams => forkJoin(streams.map(stream => this.refs.count({
        query: `${stream.origin || '@'}:(${this.store.account.alarmsQuery})`,
        modifiedAfter: this.store.account.notificationCursors.get(stream.origin),
      })))),
    ).subscribe(counts => runInAction(() =>
      this.store.account.alarmCount = counts.reduce((sum, count) => sum + count, 0)));
  }

  get notificationStreams(): NotificationStream[] {
    const mailboxes = [
      this.store.account.mailbox,
      ...(this.store.account.modmail || []),
      ...(this.store.account.outboxes || []),
      ...this.origins.aliasesFor(this.store.account.tag).map(alias => {
        const origin = tagOrigin(alias);
        return getMailbox(alias, origin) + origin;
      }),
    ].filter(mailbox => !!mailbox) as string[];
    const grouped = new Map<string, string[]>();
    for (const mailbox of uniq(mailboxes)) {
      const origin = tagOrigin(mailbox);
      grouped.set(origin, [...(grouped.get(origin) || []), mailbox]);
    }
    return Array.from(grouped).map(([origin, boxes]) => {
      const selectors = origin
        ? this.origins.aliasesFor(this.store.account.tag, origin)
        : [this.store.account.tag];
      const excludeAuthors = selectors.map(selector => `!${selector}`).join(':');
      const alarms = this.store.account.alarmsQuery ? `|${this.store.account.alarmsQuery}` : '';
      return {
        origin,
        query: `${origin || '@'}:${excludeAuthors ? excludeAuthors + ':' : ''}!plugin/delete:(${boxes.join('|')}${alarms})`,
        settingsUrl: cursorSettingsUrl(origin, this.store.account.origin),
      };
    });
  }

  loadNotificationCursors$(): Observable<NotificationStream[]> {
    const account = this.store.account.tagWithOrigin;
    if (this.cursorAccount !== account) {
      this.cursorAccount = account;
      this.cursorRefs.clear();
      runInAction(() => this.store.account.notificationCursors.clear());
    }
    const streams = this.notificationStreams;
    if (!streams.length) return of(streams);
    if (streams.every(stream => this.store.account.notificationCursors.has(stream.origin))) return of(streams);
    if (this._notificationCursors$) return this._notificationCursors$;
    this._notificationCursors$ = forkJoin(streams.map(stream => {
      if (this.store.account.notificationCursors.has(stream.origin)) return of(undefined);
      return this.tags.getResponse(stream.settingsUrl).pipe(
        catchError(() => of(undefined)),
        switchMap(ref => {
          this.cursorRefs.set(stream.origin, ref);
          const existing = ref?.plugins?.[CURSOR_PLUGIN]?.cursor;
          if (existing) {
            runInAction(() => this.store.account.notificationCursors.set(stream.origin, existing));
            return of(undefined);
          }
          const initial = stream.origin
            ? DateTime.now().toISO()!
            : this.store.account.config.lastNotified || DateTime.now().toISO()!;
          return this.writeNotificationCursor$(stream, initial);
        }),
      );
    })).pipe(
      map(() => streams),
      finalize(() => this._notificationCursors$ = undefined),
      shareReplay(1),
    );
    return this._notificationCursors$;
  }

  private writeNotificationCursor$(stream: NotificationStream, cursor: string): Observable<unknown> {
    const ref = this.cursorRefs.get(stream.origin);
    let write$: Observable<unknown>;
    if (!ref) {
      write$ = this.tags.mergeResponse([CURSOR_PLUGIN], stream.settingsUrl, {
        [CURSOR_PLUGIN]: { cursor },
      }).pipe(
        switchMap(() => this.tags.getResponse(stream.settingsUrl)),
        tap(created => this.cursorRefs.set(stream.origin, created)),
      );
    } else {
      const plugin = ref.plugins?.[CURSOR_PLUGIN];
      const path = '/plugins/' + escapePath(CURSOR_PLUGIN);
      const patch = [{
        op: 'add',
        path: plugin ? path + '/cursor' : path,
        value: plugin ? cursor : { cursor },
      }] as const;
      if (plugin && ref.modifiedString) {
        write$ = this.refs.patch(ref.url, ref.origin || this.store.account.origin, ref.modifiedString, [...patch]).pipe(
          tap(modified => this.cursorRefs.set(stream.origin, {
            ...ref,
            modified: DateTime.fromISO(modified),
            modifiedString: modified,
          })),
        );
      } else {
        write$ = this.tags.patchResponse([CURSOR_PLUGIN], stream.settingsUrl, [...patch]);
      }
    }
    return write$.pipe(tap(() => runInAction(() =>
      this.store.account.notificationCursors.set(stream.origin, cursor))));
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
    let patchValue = value;
    if (!this.store.account.config[name]) {
      patchValue = [value];
    } else {
      if ((this.store.account.config[name] as any[]).includes(value)) return of();
      path += '/-';
    }
    return this.exts.patch(this.store.account.tag, this.store.account.ext!.modifiedString!, [{
        op: 'add',
        path: '/config/' + path,
        value: patchValue,
      }]).pipe(tap(cursor => runInAction(() => {
        this.store.account.ext = <Ext> {
          ...this.store.account.ext,
          config: {
            ...this.store.account.config,
            [name]: [
              ...(this.store.account.config[name] as any[] || []),
              value,
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
}
