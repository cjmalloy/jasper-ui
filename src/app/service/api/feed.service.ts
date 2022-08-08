import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { Feed, mapFeed } from '../../model/feed';
import { mapPage, Page } from '../../model/page';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class FeedService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/feed';
  }

  create(feed: Feed): Observable<void> {
    return this.http.post<void>(this.base, feed).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  exists(url: string, origin = ''): Observable<boolean> {
    return this.http.get(`${this.base}/exists`, {
      params: params({ url, origin }),
      responseType: 'text',
    }).pipe(
      map(v => v === 'true'),
      catchError(err => this.login.handleHttpError(err)),
      catchError(err => of(false)),
    );
  }

  get(url: string, origin = ''): Observable<Feed> {
    return this.http.get(this.base, {
      params: params({ url, origin }),
    }).pipe(
      map(mapFeed),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Feed>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapFeed)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(feed: Feed): Observable<void> {
    return this.http.put<void>(this.base, feed).pipe(
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

  scrape(url: string, origin = ''): Observable<void> {
    return this.http.get<void>(`${this.base}/scrape`, {
      params: params({ url, origin }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
