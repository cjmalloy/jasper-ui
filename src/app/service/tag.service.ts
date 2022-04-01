import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { mapTag, Tag } from "../model/tag";
import { map, Observable } from "rxjs";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";

@Injectable({
  providedIn: 'root'
})
export class TagService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/tag';
  }

  create(tag: Tag): Observable<void> {
    return this.http.post<void>(this.base, tag);
  }

  get(tag: string): Observable<Tag> {
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
  }): Observable<Page<Tag>> {
    return this.http.get(`${this.base}/list`, {
      params: params(args),
    }).pipe(map(mapPage(mapTag)));
  }

  update(tag: Tag): Observable<void> {
    return this.http.put<void>(this.base, tag);
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    });
  }
}
