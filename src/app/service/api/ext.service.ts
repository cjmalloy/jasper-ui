import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { Ext, mapTag, writeExt } from '../../model/ext';
import { mapPage, Page } from '../../model/page';
import { TagPageArgs, TagQueryArgs } from '../../model/tag';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class ExtService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/ext';
  }

  private get repl() {
    return this.config.api + '/api/v1/repl/ext';
  }

  create(ext: Ext): Observable<void> {
    return this.http.post<void>(this.base, writeExt(ext)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  push(ext: Ext, origin = ''): Observable<void> {
    return this.http.post<void>(this.repl, [writeExt(ext)], {
      params: params({ origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag: string): Observable<Ext> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(mapTag),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args?: TagPageArgs): Observable<Page<Ext>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapTag)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  count(args?: TagQueryArgs): Observable<number> {
    return this.http.get(`${this.base}/count`, {
      responseType: 'text',
      params: params(args),
    }).pipe(
      map(parseInt),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(ext: Ext): Observable<void> {
    return this.http.put<void>(this.base, writeExt(ext)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  patch(tag: string, patch: any[]): Observable<void> {
    return this.http.patch<void>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag }),
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
}
