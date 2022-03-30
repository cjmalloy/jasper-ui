import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { mapPlugin, Plugin } from "../model/plugin";
import { map, Observable } from "rxjs";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";

@Injectable({
  providedIn: 'root'
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
    return this.http.post<void>(this.base, plugin);
  }

  get(tag: string, origin = ''): Observable<Plugin> {
    return this.http.get(this.base, {
      params: { tag, origin },
    }).pipe(map(mapPlugin));
  }

  page(
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  ): Observable<Page<Plugin>> {
    return this.http.get(`${this.base}/list`, {
      params: params({ query, page, size, sort, direction }),
    }).pipe(map(mapPage(mapPlugin)));
  }

  update(plugin: Plugin): Observable<void> {
    return this.http.put<void>(this.base, plugin);
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    });
  }
}
