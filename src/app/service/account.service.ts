import { Injectable } from "@angular/core";
import { UserService } from "./user.service";
import { BehaviorSubject, catchError, map, Observable, of, shareReplay } from "rxjs";
import { User } from "../model/user";
import { ExtService } from "./ext.service";
import { Ext } from "../model/ext";
import { mergeMap, tap } from "rxjs/operators";
import * as moment from "moment";
import { RefService } from "./ref.service";
import { getInbox } from "../plugin/inbox";
import { Ref } from "../model/ref";
import { capturesAny, isOwner, qualifyTags } from "../util/tag";
import * as _ from "lodash";
import { TemplateService } from "./template.service";

export const CACHE_MS = 15000;

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  tag = '';
  admin = false;
  mod = false;
  notifications = new BehaviorSubject(0);

  private user$?: Observable<User>;
  private userExt$?: Observable<Ext>;

  constructor(
    private templates: TemplateService,
    private users: UserService,
    private exts: ExtService,
    private refs: RefService,
  ) { }

  get inbox() {
    return getInbox(this.tag);
  }

  init() {
    return this.users.whoAmI().pipe(
      tap(tag => this.tag = tag),
      mergeMap(() => this.users.amIAdmin()),
      tap(admin => this.admin = admin),
      mergeMap(() => this.users.amIMod()),
      tap(mod => this.mod = mod),
      mergeMap(() => this.getMyUserExt()),
      catchError(err => this.templates.get('user')),
      mergeMap(() => this.exts.create({ tag: this.tag})),
      catchError(err => of(null)),
    );
  }

  signedIn() {
    return !!this.tag;
  }

  clearCache() {
    this.userExt$ = undefined;
    this.user$ = undefined;
  }

  getMyUser(): Observable<User> {
    if (!this.signedIn()) throw 'Not signed in';
    if (!this.user$) {
      this.user$ = this.users.get(this.tag).pipe(
        shareReplay(1),
      );
      _.delay(() => this.user$ = undefined, CACHE_MS);
    }
    return this.user$;
  }

  getMyUserExt(): Observable<Ext> {
    if (!this.signedIn()) throw 'Not signed in';
    if (!this.userExt$) {
      this.userExt$ = this.exts.get(this.tag).pipe(
        shareReplay(1),
      );
      _.delay(() => this.userExt$ = undefined, CACHE_MS);
    }
    return this.userExt$;
  }

  checkNotifications() {
    if (!this.signedIn()) throw 'Not signed in';
    return this.getMyUserExt().pipe(
      mergeMap(ext => this.refs.count({
        query: this.inbox,
        modifiedAfter: ext.config?.inbox?.lastNotified || moment().subtract(1, 'year') }))
    ).subscribe(count => this.notifications.next(count));
  }

  clearNotifications() {
    if (!this.signedIn()) throw 'Not signed in';
    this.exts.patch(this.tag, [{
      op: 'add',
      path: '/config/inbox/lastNotified',
      value: moment().toISOString(),
    }]).subscribe(() => {
      this.clearCache();
      this.checkNotifications();
    });
  }

  writeAccess(ref: Ref): Observable<boolean> {
    if (!this.signedIn()) return of(false);
    if (ref.tags?.includes('locked')) return of(this.admin);
    if (this.mod) return of(true);
    return this.getMyUser().pipe(
      map(user => isOwner(user, ref) || capturesAny(user.writeAccess, qualifyTags(ref.tags, ref.origin)))
    );
  }

  writeAccessTag(tag: string): Observable<boolean> {
    if (!this.signedIn()) return of(false);
    if (tag === 'locked') return of(this.admin);
    if (this.mod) return of(true);
    return this.getMyUser().pipe(
      map(user => tag === user.tag || capturesAny(user.writeAccess, [tag]))
    );
  }
}
