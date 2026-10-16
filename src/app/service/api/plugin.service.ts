import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapPlugin, Plugin, writePlugin } from '../../model/plugin';
import { TagPageArgs } from '../../model/tag';
import { params } from '../../util/http';
import { OpPatch } from '../../util/json-patch';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class PluginService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private login = inject(LoginService);


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

  page(args: TagPageArgs): Observable<Page<Plugin>> {
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

  patch(tag: string, cursor: string, patch: OpPatch[]): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  merge(tag: string, cursor: string, patch: Partial<Plugin>): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string): Observable<any> {
    return this.http.delete<void>(this.base, {
      params: params({ tag }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
