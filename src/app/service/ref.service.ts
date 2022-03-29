import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { map, Observable } from "rxjs";
import { mapRef, Ref } from "../model/ref";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";

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
  ): Observable<Page<Ref>> {
    return this.http.get(`${this.base}/list`, {
      params: params({ query, page, size, sort, direction }),
    }).pipe(map(mapPage(mapRef)));
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
