import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Ext, mapTag } from '../../model/ext';
import { mapPage, Page } from '../../model/page';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root',
})
export class ExtService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/ext';
  }

  create(tag: Ext): Observable<void> {
    return this.http.post<void>(this.base, tag);
  }

  get(tag: string): Observable<Ext> {
    return this.http.get(this.base, {
      params: { tag },
    }).pipe(map(mapTag));
  }

  page(args?: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Ext>> {
    return this.http.get(`${this.base}/list`, {
      params: params(args),
    }).pipe(map(mapPage(mapTag)));
  }

  update(ext: Ext): Observable<void> {
    return this.http.put<void>(this.base, ext);
  }

  patch(tag: string, patch: any[]): Observable<void> {
    return this.http.patch<void>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag }),
    });
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    });
  }
}
