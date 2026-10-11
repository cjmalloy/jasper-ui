import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { Profile, ProfilePageArgs } from '../../model/profile';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private login = inject(LoginService);


  private get base() {
    return this.config.api + '/api/v1/profile';
  }

  create(profile: Profile): Observable<void> {
    return this.http.post<void>(this.base, profile).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  getProfile(tag: string): Observable<Profile> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(p => p as Profile),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args: ProfilePageArgs): Observable<Page<Profile>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(res => res as Profile)),
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

  activate(tag: string): Observable<void> {
    return this.http.post<void>(`${this.base}/activate`, tag).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  deactivate(tag: string): Observable<void> {
    return this.http.post<void>(`${this.base}/deactivate`, tag).pipe(
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
