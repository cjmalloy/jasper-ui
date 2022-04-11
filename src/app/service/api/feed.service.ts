import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Feed, mapFeed } from '../../model/feed';
import { mapPage, Page } from '../../model/page';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root',
})
export class FeedService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/feed';
  }

  create(feed: Feed): Observable<void> {
    return this.http.post<void>(this.base, feed);
  }

  get(url: string, origin = ''): Observable<Feed> {
    return this.http.get(this.base, {
      params: params({ url, origin }),
    }).pipe(map(mapFeed));
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
    }).pipe(map(mapPage(mapFeed)));
  }

  update(feed: Feed): Observable<void> {
    return this.http.put<void>(this.base, feed);
  }

  patch(url: string, origin: string, patch: any[]): Observable<void> {
    return this.http.patch<void>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ url, origin }),
    });
  }

  delete(url: string, origin = ''): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ url, origin }),
    });
  }

  scrape(url: string, origin = ''): Observable<void> {
    return this.http.get<void>(`${this.base}/scrape`, {
      params: params({ url, origin }),
    });
  }
}
