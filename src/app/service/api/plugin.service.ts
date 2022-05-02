import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapPlugin, Plugin, writePlugin } from '../../model/plugin';
import { params } from '../../util/http';
import { AccountService } from '../account.service';
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
    return this.http.get(`${this.base}/exists`, {
      params: params({ tag }),
      responseType: 'text',
    }).pipe(
      map(v => v === 'true'),
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
