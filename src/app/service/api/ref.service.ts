import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapRef, Ref, writeRef } from '../../model/ref';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root',
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

  exists(url: string, origin = ''): Observable<boolean> {
    return this.http.get(`${this.base}/exists`, {
      params: { url, origin },
      responseType: 'text',
    }).pipe(map(v => v === 'true'));
  }

  get(url: string, origin = ''): Observable<Ref> {
    return this.http.get(this.base, {
      params: { url, origin },
    }).pipe(map(mapRef));
  }

  page(args?: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
    modifiedAfter?: moment.Moment,
    responses?: string,
    sources?: string,
    uncited?: boolean,
    unsourced?: boolean,
  }): Observable<Page<Ref>> {
    return this.http.get(`${this.base}/list`, {
      params: params(args),
    }).pipe(map(mapPage(mapRef)));
  }

  count(args: {
    query?: string,
    modifiedAfter?: moment.Moment,
    responses?: string,
    sources?: string,
    uncited?: boolean,
    unsourced?: boolean,
  }): Observable<number> {
    return this.http.get(`${this.base}/count`, {
      responseType: 'text',
      params: params(args),
    }).pipe(map(parseInt));
  }

  update(ref: Ref): Observable<void> {
    return this.http.put<void>(this.base, writeRef(ref));
  }

  patch(url: string, origin: string, patch: any[]): Observable<void> {
    return this.http.patch<void>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ url, origin }),
    });
  }

  delete(url: string, origin = ''): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { url, origin },
    });
  }
}
