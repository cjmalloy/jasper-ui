import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { Feed, mapFeed } from "../model/feed";
import { map, Observable } from "rxjs";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";

@Injectable({
  providedIn: 'root'
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
      params: { url, origin },
    }).pipe(map(mapFeed));
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Feed>> {
    return this.http.get(`${this.base}/list`, {
      params: params(args),
    }).pipe(map(mapPage(mapFeed)));
  }

  update(feed: Feed): Observable<void> {
    return this.http.put<void>(this.base, feed);
  }

  delete(url: string, origin = ''): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { url, origin },
    });
  }
}
