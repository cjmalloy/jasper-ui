import { Injectable } from "@angular/core";
import { UserService } from "./user.service";
import { BehaviorSubject, catchError, Observable, of } from "rxjs";
import { User } from "../model/user";
import { ExtService } from "./ext.service";
import { Ext } from "../model/ext";
import { mergeMap, tap } from "rxjs/operators";
import * as moment from "moment";
import { RefService } from "./ref.service";
import { getInbox } from "../plugin/inbox";

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  tag = '';
  admin = false;
  mod = false;
  notifications = new BehaviorSubject(0);

  constructor(
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
      catchError(err => this.exts.create({ tag: this.tag})),
      catchError(err => of(null)),
    );
  }

  signedIn() {
    return !!this.tag;
  }

  getMyUser(): Observable<User> {
    if (!this.signedIn()) throw 'Not signed in';
    return this.users.get(this.tag);
  }

  getMyUserExt(): Observable<Ext> {
    if (!this.signedIn()) throw 'Not signed in';
    return this.exts.get(this.tag);
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
    }]).subscribe(() => this.checkNotifications());
  }
}
