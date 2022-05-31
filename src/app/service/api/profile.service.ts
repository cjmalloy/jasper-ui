import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { Profile } from '../../model/profile';
import { mapUser, User } from '../../model/user';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/profile';
  }

  create(profile: Profile): Observable<void> {
    return this.http.post<void>(this.base, profile).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getRoles(tag: string): Observable<string[]> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(res => res as string[]),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args: {
    page?: number,
    size?: number,
  }): Observable<Page<string>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(res => res as string)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  changePassword(profile: Profile): Observable<void> {
    return this.http.post<void>(`${this.base}/password`, profile).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  changeRole(profile: Profile): Observable<void> {
    return this.http.post<void>(`${this.base}/role`, profile).pipe(
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
}
