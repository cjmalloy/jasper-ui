import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext } from '../../model/ext';
import { mapPage, Page } from '../../model/page';
import { TagPageArgs } from '../../model/tag';
import { mapUser, Roles, User, writeUser } from '../../model/user';
import { params } from '../../util/http';
import { OpPatch } from '../../util/json-patch';
import { localTag, tagOrigin } from '../../util/tag';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/user';
  }

  create(user: User): Observable<string> {
    return this.http.post<string>(this.base, writeUser(user)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag: string): Observable<User> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(mapUser),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args: TagPageArgs): Observable<Page<User>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapUser)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(user: User): Observable<string> {
    return this.http.put<string>(this.base, writeUser(user)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  keygen(tag: string): Observable<void> {
    return this.http.post<void>(`${this.base}/keygen`, null, {
      params: params({ tag }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  patch(tag: string, cursor: string, patch: OpPatch[]): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  merge(tag: string, cursor: string, patch: Partial<User>): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  whoAmI(): Observable<Roles> {
    return this.http.get<Roles>(`${this.base}/whoami`).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
