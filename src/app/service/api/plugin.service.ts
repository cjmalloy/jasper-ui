import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapPlugin, maybePlugin, Plugin, writePlugin } from '../../model/plugin';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class PluginService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/plugin';
  }

  create(plugin: Plugin): Observable<void> {
    return this.http.post<void>(this.base, writePlugin(plugin)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag: string): Observable<Plugin> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(mapPlugin),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  exists(tag: string): Observable<boolean> {
    return this.http.head(this.base, {
      params: params({ tag }),
    }).pipe(
      map(() => true),
      catchError(err => this.login.handleHttpError(err)),
      catchError(() => of(false)),
    );
  }

  list(tags: string[]): Observable<(Plugin | undefined)[]> {
    return this.http.get(`${this.base}/list`, {
      params: params({ tags }),
    }).pipe(
      map(res => res as any[]),
      map(res => res.map(maybePlugin)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Plugin>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapPlugin)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(plugin: Plugin): Observable<void> {
    return this.http.put<void>(this.base, writePlugin(plugin)).pipe(
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
