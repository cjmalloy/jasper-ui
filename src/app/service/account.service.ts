import { Injectable } from "@angular/core";
import { UserService } from "./user.service";
import { catchError, Observable } from "rxjs";
import { User } from "../model/user";
import { ExtService } from "./ext.service";
import { Ext } from "../model/ext";
import { mergeMap, tap } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  tag?: string;

  constructor(
    private users: UserService,
    private exts: ExtService,
  ) { }

  init() {
    return this.users.whoAmI().pipe(
      tap(tag => this.tag = tag),
      mergeMap(() => this.getMyUserExt()),
      catchError(err => this.exts.create({ tag: this.tag!}))
    );
  }

  getMyUser(): Observable<User> {
    if (!this.tag) return this.users.whoAmI().pipe(tap(tag => this.tag = tag), mergeMap(tag => this.users.get(tag)));
    return this.users.get(this.tag!);
  }

  getMyUserExt(): Observable<Ext> {
    if (!this.tag) return this.users.whoAmI().pipe(tap(tag => this.tag = tag), mergeMap(tag => this.exts.get(tag)));
    return this.exts.get(this.tag!);
  }
}
