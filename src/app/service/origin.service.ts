import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { mapOrigin, Origin } from "../model/origin";
import { map, Observable } from "rxjs";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";

@Injectable({
  providedIn: 'root'
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

  get(tag: string, origin = ''): Observable<Origin> {
    return this.http.get(this.base, {
      params: { tag, origin },
    }).pipe(map(mapOrigin));
  }

  page(
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  ): Observable<Page<Origin>> {
    return this.http.get(`${this.base}/list`, {
      params: params({ query, page, size, sort, direction }),
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
