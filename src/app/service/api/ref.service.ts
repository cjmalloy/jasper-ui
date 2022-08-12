import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapRef, mapRefOrNull, Ref, RefPageArgs, RefQueryArgs, writeRef } from '../../model/ref';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class RefService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/ref';
  }

  create(ref: Ref): Observable<void> {
    return this.http.post<void>(this.base, ref).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(url: string, origin = ''): Observable<Ref> {
    return this.http.get(this.base, {
      params: params({ url, origin }),
    }).pipe(
      map(mapRef),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  exists(url: string, origin = ''): Observable<boolean> {
    return this.http.head(this.base, {
      params: params({ url, origin }),
    }).pipe(
      map(() => true),
      catchError(err => this.login.handleHttpError(err)),
      catchError(err => of(false)),
    );
  }

  list(urls: string[], origin = ''): Observable<(Ref | null)[]> {
    return this.http.get(`${this.base}/list`, {
      params: params({ urls, origin }),
    }).pipe(
      map(res => res as any[]),
      map(res => res.map(mapRefOrNull)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args?: RefPageArgs): Observable<Page<Ref>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapRef)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  count(args?: RefQueryArgs): Observable<number> {
    return this.http.get(`${this.base}/count`, {
      responseType: 'text',
      params: params(args),
    }).pipe(
      map(parseInt),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(ref: Ref): Observable<void> {
    return this.http.put<void>(this.base, writeRef(ref)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  patch(url: string, origin: string, patch: any[]): Observable<void> {
    return this.http.patch<void>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(url: string, origin = ''): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
