import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { map, Observable } from "rxjs";
import { mapRef, Ref } from "../model/ref";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";
import * as moment from "moment";

@Injectable({
  providedIn: 'root'
})
export class RefService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/ref';
  }

  create(ref: Ref): Observable<void> {
    return this.http.post<void>(this.base, ref);
  }

  get(url: string, origin = ''): Observable<Ref> {
    return this.http.get(this.base, {
      params: { url, origin },
    }).pipe(map(mapRef));
  }

  page(
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
    modifiedAfter?: moment.Moment,
  ): Observable<Page<Ref>> {
    return this.http.get(`${this.base}/list`, {
      params: params({ query, page, size, sort, direction, modifiedAfter }),
    }).pipe(map(mapPage(mapRef)));
  }

  count(query?: string, modifiedAfter?: moment.Moment): Observable<number> {
    return this.http.get(`${this.base}/count`, {
      responseType: 'text',
      params: params({ query, modifiedAfter }),
    }).pipe(map(parseInt));
  }

  getResponses(
    url: string,
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
    modifiedAfter?: moment.Moment,
  ): Observable<Page<Ref>> {
    return this.http.get(`${this.base}/responses`,{
      params: params({ url, query, page, size, sort, direction, modifiedAfter }),
    }).pipe(map(mapPage(mapRef)));
  }

  countResponses(url: string, query?: string, modifiedAfter?: moment.Moment): Observable<number> {
    return this.http.get(`${this.base}/responses/count`,{
      responseType: 'text',
      params: params({ url, query, modifiedAfter }),
    }).pipe(map(parseInt));
  }

  getSources(
    url: string,
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
    modifiedAfter?: moment.Moment,
  ): Observable<Page<Ref>> {
    return this.http.get(`${this.base}/sources`,{
      params: params({ url, query, page, size, sort, direction, modifiedAfter }),
    }).pipe(map(mapPage(mapRef)));
  }

  countSources(url: string, query?: string, modifiedAfter?: moment.Moment): Observable<number> {
    return this.http.get(`${this.base}/sources/count`,{
      responseType: 'text',
      params: params({ url, query, modifiedAfter }),
    }).pipe(map(parseInt));
  }

  update(ref: Ref): Observable<void> {
    return this.http.put<void>(this.base, ref);
  }

  delete(url: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { url },
    });
  }
}
