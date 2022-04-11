import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import * as moment from 'moment';
import { BehaviorSubject, catchError, forkJoin, map, Observable, of, shareReplay } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { Ext } from '../model/ext';
import { HasTags } from '../model/tag';
import { User } from '../model/user';
import { getInbox } from '../plugin/inbox';
import { defaultSubs } from '../template/user';
import { capturesAny, isOwner, qualifyTags } from '../util/tag';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { RefService } from './api/ref.service';
import { UserService } from './api/user.service';

export const CACHE_MS = 15000;

@Injectable({
  providedIn: 'root',
})
export class AccountService {

  tag = '';
  admin = false;
  mod = false;
  notifications = new BehaviorSubject(0);

  private _user$?: Observable<User>;
  private _userExt$?: Observable<Ext>;

  constructor(
    private adminService: AdminService,
    private users: UserService,
    private exts: ExtService,
    private refs: RefService,
  ) { }

  get inbox() {
    return getInbox(this.tag);
  }

  get init$() {
    return this.users.whoAmI().pipe(
      tap(tag => this.tag = tag),
      mergeMap(tag => tag ? this.loadUser$ : of()),
    );
  }

  get loadUser$() {
    return forkJoin(
      this.users.amIAdmin().pipe(tap(admin => this.admin = admin)),
      this.users.amIMod().pipe(tap(mod => this.mod = mod)),
      this.loadUserExt$,
    );
  }

  get loadUserExt$() {
    if (!this.adminService.status.templates.user) return of();
    return this.userExt$.pipe(catchError(err => this.exts.create({ tag: this.tag })));
  }

  get signedIn() {
    return !!this.tag;
  }

  clearCache() {
    this._userExt$ = undefined;
    this._user$ = undefined;
  }

  get user$(): Observable<User> {
    if (!this.signedIn) throw 'Not signed in';
    if (!this._user$) {
      this._user$ = this.users.get(this.tag).pipe(
        shareReplay(1),
      );
      _.delay(() => this._user$ = undefined, CACHE_MS);
    }
    return this._user$;
  }

  get userExt$(): Observable<Ext> {
    if (!this.signedIn) throw 'Not signed in';
    if (!this._userExt$) {
      this._userExt$ = this.exts.get(this.tag).pipe(
        shareReplay(1),
      );
      _.delay(() => this._userExt$ = undefined, CACHE_MS);
    }
    return this._userExt$;
  }

  get subscriptions$(): Observable<string[]> {
    if (!this.signedIn || !this.adminService.status.templates.user) return of(defaultSubs);
    return this.userExt$.pipe(map(ext => ext.config.subscriptions),
    );
  }

  subscribe(tag: string) {
    this.exts.patch(this.tag, [{
      op: 'add',
      path: '/config/subscriptions/-',
      value: tag,
    }]).subscribe(() => {
      this.clearCache();
    });
  }

  unsubscribe(tag: string) {
    this.subscriptions$.pipe(
      map(subs => subs.indexOf(tag)),
      mergeMap(index => this.exts.patch(this.tag,[{
        op: 'remove',
        path: '/config/subscriptions/' + index,
      }]))
    ).subscribe(() => {
      this.clearCache();
    });
  }

  checkNotifications() {
    if (!this.signedIn) throw 'Not signed in';
    return this.userExt$.pipe(
      mergeMap(ext => this.refs.count({
        query: this.inbox,
        modifiedAfter: ext.config?.inbox?.lastNotified || moment().subtract(1, 'year'),
      })),
    ).subscribe(count => this.notifications.next(count));
  }

  clearNotifications() {
    if (!this.signedIn) throw 'Not signed in';
    this.exts.patch(this.tag, [{
      op: 'add',
      path: '/config/inbox/lastNotified',
      value: moment().toISOString(),
    }]).subscribe(() => {
      this.clearCache();
      this.checkNotifications();
    });
  }

  writeAccess(ref: HasTags): Observable<boolean> {
    if (!this.signedIn) return of(false);
    if (ref.tags?.includes('locked')) return of(false);
    if (this.mod) return of(true);
    return this.user$.pipe(
      map(user => isOwner(user, ref) || capturesAny(user.writeAccess, qualifyTags(ref.tags, ref.origin))),
    );
  }

  writeAccessTag(tag: string): Observable<boolean> {
    if (!tag) return of(false);
    if (!tag.endsWith('@*') && tag.includes('@')) return of(false);
    if (!this.signedIn) return of(false);
    if (tag === 'locked') return of(false);
    if (this.mod) return of(true);
    return this.user$.pipe(
      map(user => tag === user.tag || capturesAny(user.writeAccess, [tag])),
    );
  }
}
