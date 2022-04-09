import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapOrigin, Origin } from '../../model/origin';
import { mapPage, Page } from '../../model/page';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root',
})
export class OriginService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/origin';
  }

  create(origin: Origin): Observable<void> {
    return this.http.post<void>(this.base, origin);
  }

  get(origin: string): Observable<Origin> {
    return this.http.get(this.base, {
      params: { origin },
    }).pipe(map(mapOrigin));
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Origin>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(map(mapPage(mapOrigin)));
  }

  update(origin: Origin): Observable<void> {
    return this.http.put<void>(this.base, origin);
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    });
  }
}
