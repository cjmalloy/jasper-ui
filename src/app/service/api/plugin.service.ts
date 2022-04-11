import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapPlugin, Plugin, writePlugin } from '../../model/plugin';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root',
})
export class PluginService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/plugin';
  }

  create(plugin: Plugin): Observable<void> {
    return this.http.post<void>(this.base, writePlugin(plugin));
  }

  get(tag: string): Observable<Plugin> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(map(mapPlugin));
  }

  exists(tag: string): Observable<boolean> {
    return this.http.get(`${this.base}/exists`, {
      params: params({ tag }),
      responseType: 'text',
    }).pipe(map(v => v === 'true'));
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Plugin>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(map(mapPage(mapPlugin)));
  }

  update(plugin: Plugin): Observable<void> {
    return this.http.put<void>(this.base, writePlugin(plugin));
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: params({ tag }),
    });
  }
}
