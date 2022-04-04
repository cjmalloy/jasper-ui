import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ConfigService } from "./config.service";
import { mapTemplate, Template } from "../model/template";
import { map, Observable } from "rxjs";
import { mapPage, Page } from "../model/page";
import { params } from "../util/http";

@Injectable({
  providedIn: 'root'
})
export class TemplateService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/template';
  }

  create(template: Template): Observable<void> {
    return this.http.post<void>(this.base, template);
  }

  get(tag: string, origin = ''): Observable<Template> {
    return this.http.get(this.base, {
      params: { tag, origin },
    }).pipe(map(mapTemplate));
  }

  page(args: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Template>> {
    return this.http.get(`${this.base}/list`, {
      params: params(args),
    }).pipe(map(mapPage(mapTemplate)));
  }

  update(template: Template): Observable<void> {
    return this.http.put<void>(this.base, template);
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    });
  }
}
