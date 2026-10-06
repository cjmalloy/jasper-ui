import { Injectable } from '@angular/core';
import { delay, isArray, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
import {
  catchError,
  EMPTY,
  expand,
  finalize,
  firstValueFrom,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  shareReplay,
  Subscription,
  throwError,
  toArray,
} from 'rxjs';
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
const CURSOR_CONCURRENCY = 6;
const DISCOVER_PAGE_SIZE = 100;

export interface NotificationStream {
  origin: string;
  query: string;
  alarmQuery?: string;
  settingsUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class AccountService {

  private _user$?: Observable<User | undefined>;
  private _userExt$?: Observable<Ext>;
  private cursorAccount = '';
  private cursorRefs = new Map<string, Ref | undefined>();
  private alarmOrigins = new Map<string, string>();
  private cursorLoads = new Map<string, Observable<undefined>>();
  private check?: Subscription;

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
      tap(() => {
        this.clearCache();
        this.checkNotifications();
      }),
      switchMap(() => this.alarms$),
    );
  }

  removeAlarm$(tag: string): Observable<any> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    return this.alarms$.pipe(
      switchMap(() => this.removeConfigArray$('alarms', tag)),
      tap(() => {
        this.clearCache();
        this.checkNotifications();
      }),
      switchMap(() => this.alarms$),
    );
  }

  checkNotifications() {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    this.check?.unsubscribe();
    this.check = this.loadNotificationCursors$().pipe(
      switchMap(streams => {
        const otherAlarms = this.otherAlarmsQuery(streams);
        const counts = streams.map(stream => {
          const modifiedAfter = this.store.account.notificationCursors.get(stream.origin);
          return forkJoin([
            this.refs.count({ query: stream.query, modifiedAfter }),
            stream.alarmQuery
              ? this.refs.count({ query: stream.alarmQuery, modifiedAfter })
              : of(0),
          ]);
        });
        if (otherAlarms) {
          counts.push(this.refs.count({
            query: otherAlarms,
            modifiedAfter: this.store.account.notificationCursors.get(this.store.account.origin),
          }).pipe(map(count => [count, count])));
        }
        return counts.length ? forkJoin(counts) : of([]);
      }),
    ).subscribe(counts => runInAction(() => {
      this.store.account.notifications = counts.reduce((sum, [count]) => sum + count, 0);
      this.store.account.alarmCount = counts.reduce((sum, [, count]) => sum + count, 0);
    }));
  }

  notificationPage$(size: number): Observable<Page<Ref>> {
    return this.loadNotificationCursors$().pipe(
      switchMap(streams => {
        const queries = streams.map(stream => ({
          query: stream.query,
          modifiedAfter: this.store.account.notificationCursors.get(stream.origin),
        }));
        const otherAlarms = this.otherAlarmsQuery(streams);
        if (otherAlarms) {
          queries.push({
            query: otherAlarms,
            modifiedAfter: this.store.account.notificationCursors.get(this.store.account.origin),
          });
        }
        return forkJoin(queries.map(query => this.refs.page({
          ...query,
          sort: ['modified,ASC'],
          size,
        })));
      }),
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

  clearNotificationsIfNone(readDate: DateTime | undefined, origin?: string) {
    if (!readDate) return;
    origin = origin || '';
    if (!this.store.account.signedIn) return;
    if (!this.admin.getTemplate('user')) return;
    this.loadNotificationCursors$().pipe(
      switchMap(streams => {
        let stream = streams.find(stream => stream.origin === origin);
        if (!stream && this.store.account.alarmsQuery) stream = this.notificationStream(origin, []);
        if (!stream) return EMPTY;
        const modifiedAfter = this.store.account.notificationCursors.get(stream.origin)
          || this.store.account.notificationCursors.get(this.store.account.origin);
        return this.refs.count({ query: stream.query, modifiedAfter, modifiedBefore: readDate });
      }),
    ).subscribe(count => {
      if (count === 0) {
        this.clearNotifications(readDate, [origin]);
      } else {
        runInAction(() => this.store.account.ignoreNotifications.push(readDate.valueOf()));
      }
    });
  }

  clearNotifications(readDate: DateTime = DateTime.now(), origins?: string[]): Promise<void> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    const cursor = readDate.plus({ millisecond: 1 }).toISO()!;
    origins = origins?.map(origin => origin || '');
    if (this.store.account.alarmsQuery) {
      for (const origin of origins || []) {
        if (this.store.account.notificationCursors.has(origin) || this.alarmOrigins.has(origin)) continue;
        this.alarmOrigins.set(origin, cursor);
      }
    }
    const discover$ = !origins && this.store.account.alarmsQuery
      ? this.discoverAlarmOrigins$(readDate, cursor)
      : of(undefined);
    return firstValueFrom(discover$.pipe(
      switchMap(() => this.loadNotificationCursors$()),
      switchMap(streams => {
        const writes = streams
          .filter(stream => !origins || origins.includes(stream.origin))
          .filter(stream => {
            const current = this.store.account.notificationCursors.get(stream.origin);
            return !current || readDate.plus({ millisecond: 1 }) > DateTime.fromISO(current);
          })
          .map(stream => this.writeNotificationCursor$(stream, cursor));
        return writes.length ? forkJoin(writes) : of([]);
      }),
      tap(() => this.checkNotifications()),
      map(() => undefined),
    ), { defaultValue: undefined });
  }

  /**
   * Before clearing all origins, find origins with alarms that do not have a
   * notification stream yet so they get their own cursor.
   */
  private discoverAlarmOrigins$(readDate: DateTime, cursor: string): Observable<unknown> {
    const page$ = () => this.loadNotificationCursors$().pipe(
      switchMap(streams => {
        const query = this.otherAlarmsQuery([
          ...streams,
          ...Array.from(this.alarmOrigins.keys(), origin => ({ origin } as NotificationStream)),
        ])!;
        return this.refs.page({
          query,
          modifiedAfter: this.store.account.notificationCursors.get(this.store.account.origin),
          modifiedBefore: readDate.plus({ millisecond: 1 }),
          size: DISCOVER_PAGE_SIZE,
        });
      }),
      map(page => {
        const found = uniq(page.content.map(ref => ref.origin || ''))
          .filter(origin => !this.store.account.notificationCursors.has(origin) && !this.alarmOrigins.has(origin));
        for (const origin of found) this.alarmOrigins.set(origin, cursor);
        return found.length > 0;
      }),
    );
    return page$().pipe(
      expand(more => more ? page$() : EMPTY),
      toArray(),
    );
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
    if (this.store.account.alarmsQuery) {
      for (const origin of [...this.store.account.notificationCursors.keys(), ...this.alarmOrigins.keys()]) {
        if (!grouped.has(origin)) grouped.set(origin, []);
      }
    }
    return Array.from(grouped).map(([origin, boxes]) => this.notificationStream(origin, boxes));
  }

  private notificationStream(origin: string, boxes: string[]): NotificationStream {
    const selectors = origin === this.store.account.origin
      ? [this.store.account.tag]
      : this.origins.aliasesFor(this.store.account.tag, origin);
    const excludeAuthors = selectors.map(selector => `!${selector}`).join(':');
    const alarms = this.store.account.alarmsQuery;
    const notifications = [...boxes, ...(alarms ? [alarms] : [])];
    const filter = `${origin || '@'}:${excludeAuthors ? excludeAuthors + ':' : ''}!plugin/delete`;
    return {
      origin,
      query: `${filter}:(${notifications.join('|')})`,
      ...(alarms ? { alarmQuery: `${filter}:(${alarms})` } : {}),
      settingsUrl: cursorSettingsUrl(origin, this.store.account.origin),
    };
  }

  loadNotificationCursors$(): Observable<NotificationStream[]> {
    const account = this.store.account.tagWithOrigin;
    if (this.cursorAccount !== account) {
      this.cursorAccount = account;
      this.cursorRefs.clear();
      this.cursorLoads.clear();
      this.alarmOrigins.clear();
      runInAction(() => this.store.account.notificationCursors.clear());
    }
    const streams = this.notificationStreams;
    const missing = streams.filter(stream => !this.store.account.notificationCursors.has(stream.origin));
    if (!missing.length) return of(streams);
    return from(missing).pipe(
      mergeMap(stream => {
        let load$ = this.cursorLoads.get(stream.origin);
        if (!load$) {
          load$ = this.tags.getResponse(stream.settingsUrl).pipe(
            catchError(err => err?.status === 404 ? of(undefined) : throwError(() => err)),
            switchMap(ref => {
              this.cursorRefs.set(stream.origin, ref);
              const existing = ref?.plugins?.['plugin/user/cursor']?.cursor;
              if (existing) {
                runInAction(() => this.store.account.notificationCursors.set(stream.origin, existing));
                return of(undefined);
              }
              return this.writeNotificationCursor$(stream, this.alarmOrigins.get(stream.origin) || DateTime.now().toISO()!);
            }),
            map(() => undefined),
            finalize(() => this.cursorLoads.delete(stream.origin)),
            shareReplay(1),
          );
          this.cursorLoads.set(stream.origin, load$);
        }
        return load$;
      }, CURSOR_CONCURRENCY),
      toArray(),
      map(() => streams),
    );
  }

  /**
   * Alarms can come from any origin. Count alarms from origins without a
   * notification stream. A stream is created for an origin when it is cleared.
   */
  private otherAlarmsQuery(streams: NotificationStream[]): string | undefined {
    const alarms = this.store.account.alarmsQuery;
    if (!alarms) return undefined;
    const exclude = uniq(streams.map(stream => stream.origin)).map(origin => `:!${origin || '@'}`).join('');
    return `!plugin/delete:(${alarms})${exclude}`;
  }

  private writeNotificationCursor$(stream: NotificationStream, cursor: string, retry = true): Observable<unknown> {
    const ref = this.cursorRefs.get(stream.origin);
    const plugin = ref?.plugins?.['plugin/user/cursor'];
    let write$: Observable<unknown>;
    if (!plugin) {
      write$ = this.tags.mergeResponse(['plugin/user/cursor'], stream.settingsUrl, {
        'plugin/user/cursor': { cursor },
      }).pipe(
        switchMap(() => this.tags.getResponse(stream.settingsUrl)),
        tap(created => this.cursorRefs.set(stream.origin, created)),
      );
    } else {
      const patch = [{
        op: 'add',
        path: '/plugins/' + escapePath('plugin/user/cursor') + '/cursor',
        value: cursor,
      }] as const;
      if (ref!.modifiedString) {
        write$ = this.refs.patch(ref!.url, ref!.origin || this.store.account.origin, ref!.modifiedString, [...patch]).pipe(
          tap(modified => this.cursorRefs.set(stream.origin, {
            ...ref!,
            modified: DateTime.fromISO(modified),
            modifiedString: modified,
          })),
        );
      } else {
        write$ = this.tags.patchResponse(['plugin/user/cursor'], stream.settingsUrl, [...patch]);
      }
    }
    return write$.pipe(
      tap(() => runInAction(() => this.store.account.notificationCursors.set(stream.origin, cursor))),
      catchError(err => {
        if (!retry || err?.status !== 409) return throwError(() => err);
        return this.tags.getResponse(stream.settingsUrl).pipe(
          switchMap(ref => {
            this.cursorRefs.set(stream.origin, ref);
            const existing = ref?.plugins?.['plugin/user/cursor']?.cursor;
            if (existing && DateTime.fromISO(existing) >= DateTime.fromISO(cursor)) {
              runInAction(() => this.store.account.notificationCursors.set(stream.origin, existing));
              return of(undefined);
            }
            return this.writeNotificationCursor$(stream, cursor, false);
          }),
        );
      }),
    );
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
