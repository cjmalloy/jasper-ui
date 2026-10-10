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
import { cursorSettingsUrl } from '../mods/mailbox';
import { UserConfig } from '../mods/user';
import { Store } from '../store/store';
import { escapePath } from '../util/json-patch';
import { hasPrefix, localTag, setPublic, subOrigin, tagOrigin } from '../util/tag';
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

/**
 * Compares two server cursors without losing sub-millisecond precision.
 */
export function compareCursors(a: string, b: string): number {
  const normalize = (cursor: string) =>
    DateTime.fromISO(cursor).toUTC().toFormat(`yyyy-MM-dd'T'HH:mm:ss`) + '.' +
    (/T[\d:]+\.(\d+)/.exec(cursor)?.[1] || '').padEnd(9, '0');
  const x = normalize(a);
  const y = normalize(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

interface OtherNotifications {
  origin?: undefined;
  query: string;
  alarmQuery?: string;
}

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
  private otherOrigins = new Set<string>();
  private cursorLoads = new Map<string, Observable<undefined>>();
  private savedCursors?: Observable<undefined>;
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
        const counts = [...streams, this.otherNotifications(streams)].map(stream => {
          const modifiedAfter = this.notificationCursor(stream.origin);
          return forkJoin([
            this.refs.count({ query: stream.query, modifiedAfter }),
            stream.alarmQuery
              ? this.refs.count({ query: stream.alarmQuery, modifiedAfter })
              : of(0),
          ]);
        });
        return from(counts).pipe(
          mergeMap(count => count, CURSOR_CONCURRENCY),
          toArray(),
        );
      }),
    ).subscribe(counts => runInAction(() => {
      this.store.account.notifications = counts.reduce((sum, [count]) => sum + count, 0);
      this.store.account.alarmCount = counts.reduce((sum, [, count]) => sum + count, 0);
    }));
  }

  notificationPage$(size: number): Observable<Page<Ref>> {
    return this.loadNotificationCursors$().pipe(
      switchMap(streams => {
        const queries = [...streams, this.otherNotifications(streams)].map(stream => ({
          query: stream.query,
          modifiedAfter: this.notificationCursor(stream.origin),
        }));
        return from(queries).pipe(
          mergeMap(query => this.refs.page({
            ...query,
            sort: ['modified,ASC'],
            size,
          }), CURSOR_CONCURRENCY),
          toArray(),
        );
      }),
      map(pages => {
        const content = pages
          .flatMap(page => page.content)
          .sort((a, b) => a.modifiedString && b.modifiedString
            ? compareCursors(a.modifiedString, b.modifiedString)
            : a.modified!.valueOf() - b.modified!.valueOf())
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
        const stream = streams.find(stream => stream.origin === origin) || this.notificationStream(origin!, []);
        const modifiedAfter = this.store.account.notificationCursors.get(stream.origin);
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

  /**
   * Advances notification cursors. A DateTime read date is rounded up by 1 ms,
   * while a string read date is used as an exact server cursor.
   */
  clearNotifications(readDate: DateTime | string = DateTime.now(), origins?: string[]): Promise<void> {
    if (!this.store.account.signedIn) throw 'Not signed in';
    if (!this.admin.getTemplate('user')) throw 'User template not installed';
    const cursor = typeof readDate === 'string' ? readDate : readDate.plus({ millisecond: 1 }).toISO()!;
    origins = origins?.map(origin => origin || '');
    for (const origin of origins || []) this.otherOrigins.add(origin);
    const discover$ = origins ? of(undefined) : this.discoverOtherOrigins$(cursor);
    return firstValueFrom(discover$.pipe(
      switchMap(() => this.loadNotificationCursors$()),
      switchMap(streams => {
        const writes = streams
          .filter(stream => !origins || origins.includes(stream.origin))
          .filter(stream => {
            const current = this.store.account.notificationCursors.get(stream.origin);
            return !current || compareCursors(cursor, current) > 0;
          })
          .map(stream => this.writeNotificationCursor$(stream, cursor));
        return writes.length
          ? from(writes).pipe(mergeMap(write => write, CURSOR_CONCURRENCY), toArray())
          : of([]);
      }),
      tap(() => this.checkNotifications()),
      map(() => undefined),
    ), { defaultValue: undefined });
  }

  /**
   * Before clearing all origins, find origins with notifications that do not
   * have a notification stream yet so they get their own cursor.
   */
  private discoverOtherOrigins$(readCursor: string): Observable<unknown> {
    const page$ = () => this.loadNotificationCursors$().pipe(
      switchMap(streams => this.refs.page({
        query: this.otherNotifications(streams).query,
        modifiedBefore: DateTime.fromISO(readCursor).plus({ millisecond: 1 }),
        size: DISCOVER_PAGE_SIZE,
      })),
      map(page => {
        const found = uniq(page.content.map(ref => ref.origin || ''))
          .filter(origin => !this.store.account.notificationCursors.has(origin) && !this.otherOrigins.has(origin));
        for (const origin of found) this.otherOrigins.add(origin);
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
      ...this.store.account.aliasMailboxes,
    ].filter(mailbox => !!mailbox) as string[];
    const grouped = new Map<string, string[]>();
    for (const mailbox of uniq(mailboxes)) {
      const origin = tagOrigin(mailbox);
      grouped.set(origin, [...(grouped.get(origin) || []), mailbox]);
    }
    for (const origin of [...this.store.account.notificationCursors.keys(), ...this.otherOrigins]) {
      if (!grouped.has(origin)) grouped.set(origin, []);
    }
    return Array.from(grouped).map(([origin, boxes]) => this.notificationStream(origin, boxes));
  }

  /**
   * Mailbox tags without an origin, used for origins without a known mailbox.
   */
  private get otherMailboxes(): string[] {
    return uniq([
      this.store.account.mailbox,
      ...(this.store.account.modmail || []),
    ].filter(mailbox => !!mailbox).map(mailbox => localTag(mailbox)));
  }

  private notificationStream(origin: string, boxes: string[]): NotificationStream {
    const selectors = origin === this.store.account.origin || !boxes.length
      ? [this.store.account.tag]
      : this.origins.aliasesFor(this.store.account.tag, origin);
    const excludeAuthors = selectors.map(selector => `!${selector}`).join(':');
    const alarms = this.store.account.alarmsQuery;
    const notifications = [...(boxes.length ? boxes : this.otherMailboxes), ...(alarms ? [alarms] : [])];
    const filter = `${origin || '@'}:${excludeAuthors ? excludeAuthors + ':' : ''}!plugin/delete`;
    return {
      origin,
      query: `${filter}:(${notifications.join('|')})`,
      ...(alarms ? { alarmQuery: `${filter}:(${alarms})` } : {}),
      settingsUrl: cursorSettingsUrl(origin, this.store.account.origin),
    };
  }

  /**
   * Catch-all for notifications from origins without a notification stream.
   * These origins have no cursor, so all notifications are counted.
   * A stream is created for an origin when it is cleared.
   */
  private otherNotifications(streams: NotificationStream[]): OtherNotifications {
    const exclude = uniq(streams.map(stream => stream.origin)).map(origin => `:!${origin || '@'}`).join('');
    const alarms = this.store.account.alarmsQuery;
    const notifications = [...this.otherMailboxes, ...(alarms ? [alarms] : [])];
    const filter = `!${this.store.account.localTag}:!plugin/delete${exclude}`;
    return {
      query: `${filter}:(${notifications.join('|')})`,
      ...(alarms ? { alarmQuery: `${filter}:(${alarms})` } : {}),
    };
  }

  private notificationCursor(origin?: string) {
    return origin === undefined ? undefined : this.store.account.notificationCursors.get(origin);
  }

  loadNotificationCursors$(): Observable<NotificationStream[]> {
    const account = this.store.account.tagWithOrigin;
    if (this.cursorAccount !== account) {
      this.cursorAccount = account;
      this.cursorRefs.clear();
      this.cursorLoads.clear();
      this.otherOrigins.clear();
      this.savedCursors = undefined;
      runInAction(() => this.store.account.notificationCursors.clear());
    }
    if (!this.cursorPluginInstalled) return of(this.notificationStreams);
    return this.loadSavedCursors$().pipe(switchMap(() => this.loadStreamCursors$()));
  }

  /**
   * Cursors are only kept in memory until the cursor plugin is installed.
   */
  private get cursorPluginInstalled() {
    return !!this.admin.getPlugin('plugin/user/cursor');
  }

  /**
   * Origins without a mailbox do not have a stream, so their saved cursors
   * must be found by searching for cursor Refs instead of loading each stream.
   */
  private loadSavedCursors$(): Observable<undefined> {
    if (!this.savedCursors) {
      const account = this.cursorAccount;
      const prefix = `tag:/${setPublic(this.store.account.localTag)}?url=tag:/plugin/outbox/`;
      const page$ = (page: number) => this.refs.page({
        query: `plugin/user/cursor:${account}`,
        page,
        size: DISCOVER_PAGE_SIZE,
      });
      this.savedCursors = page$(0).pipe(
        expand(result => result.page.number + 1 < result.page.totalPages ? page$(result.page.number + 1) : EMPTY),
        tap(result => runInAction(() => {
          if (this.cursorAccount !== account) return;
          for (const ref of result.content) {
            if (!ref.url.startsWith(prefix)) continue;
            const cursor = ref.plugins?.['plugin/user/cursor']?.cursor;
            if (!cursor) continue;
            const origin = subOrigin(this.store.account.origin, ref.url.substring(prefix.length));
            if (this.store.account.notificationCursors.has(origin)) continue;
            this.cursorRefs.set(origin, ref);
            this.store.account.notificationCursors.set(origin, cursor);
          }
        })),
        toArray(),
        map(() => undefined),
        catchError(err => {
          if (this.cursorAccount === account) this.savedCursors = undefined;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
    }
    return this.savedCursors;
  }

  /**
   * Loads the saved cursor for each stream. A stream without a saved cursor
   * has no cursor, so all of its notifications are counted until it is cleared.
   */
  private loadStreamCursors$(): Observable<NotificationStream[]> {
    const streams = this.notificationStreams;
    const missing = streams.filter(stream =>
      !this.store.account.notificationCursors.has(stream.origin) && !this.cursorRefs.has(stream.origin));
    if (!missing.length) return of(streams);
    const account = this.cursorAccount;
    return from(missing).pipe(
      mergeMap(stream => {
        let load$ = this.cursorLoads.get(stream.origin);
        if (!load$) {
          const shared$: Observable<undefined> = this.tags.getResponse(stream.settingsUrl).pipe(
            catchError(err => err?.status === 404 ? of(undefined) : throwError(() => err)),
            map(ref => {
              if (this.cursorAccount !== account) return undefined;
              this.cursorRefs.set(stream.origin, ref);
              const existing = ref?.plugins?.['plugin/user/cursor']?.cursor;
              if (existing) runInAction(() => this.store.account.notificationCursors.set(stream.origin, existing));
              return undefined;
            }),
            finalize(() => {
              if (this.cursorLoads.get(stream.origin) === shared$) this.cursorLoads.delete(stream.origin);
            }),
            shareReplay(1),
          );
          load$ = shared$;
          this.cursorLoads.set(stream.origin, load$);
        }
        return load$;
      }, CURSOR_CONCURRENCY),
      toArray(),
      map(() => streams),
    );
  }

  private writeNotificationCursor$(stream: NotificationStream, cursor: string, retry = true): Observable<unknown> {
    const account = this.cursorAccount;
    const ref = this.cursorRefs.get(stream.origin);
    const plugin = ref?.plugins?.['plugin/user/cursor'];
    let write$: Observable<unknown>;
    if (!this.cursorPluginInstalled) {
      write$ = of(undefined);
    } else if (!plugin) {
      write$ = this.tags.mergeResponse(['plugin/user/cursor'], stream.settingsUrl, {
        'plugin/user/cursor': { cursor },
      }).pipe(
        switchMap(() => this.cursorAccount === account ? this.tags.getResponse(stream.settingsUrl) : EMPTY),
        tap(created => {
          if (this.cursorAccount === account) this.cursorRefs.set(stream.origin, created);
        }),
      );
    } else {
      const patch = [{
        op: 'add',
        path: '/plugins/' + escapePath('plugin/user/cursor') + '/cursor',
        value: cursor,
      }] as const;
      if (ref!.modifiedString) {
        write$ = this.refs.patch(ref!.url, ref!.origin || this.store.account.origin, ref!.modifiedString, [...patch]).pipe(
          tap(modified => {
            if (this.cursorAccount !== account) return;
            this.cursorRefs.set(stream.origin, {
              ...ref!,
              modified: DateTime.fromISO(modified),
              modifiedString: modified,
            });
          }),
        );
      } else {
        write$ = this.tags.patchResponse(['plugin/user/cursor'], stream.settingsUrl, [...patch]);
      }
    }
    return write$.pipe(
      tap(() => {
        if (this.cursorAccount !== account) return;
        runInAction(() => this.store.account.notificationCursors.set(stream.origin, cursor));
      }),
      catchError(err => {
        if (!retry || err?.status !== 409) return throwError(() => err);
        if (this.cursorAccount !== account) return of(undefined);
        return this.tags.getResponse(stream.settingsUrl).pipe(
          switchMap(ref => {
            if (this.cursorAccount !== account) return of(undefined);
            this.cursorRefs.set(stream.origin, ref);
            const existing = ref?.plugins?.['plugin/user/cursor']?.cursor;
            if (existing && compareCursors(existing, cursor) >= 0) {
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
