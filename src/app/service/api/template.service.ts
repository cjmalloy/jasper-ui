import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapTemplate, Template, writeTemplate } from '../../model/template';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root',
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
    return this.http.post<void>(this.base, writeTemplate(template));
  }

  get(tag = '', origin = ''): Observable<Template> {
    return this.http.get(this.base, {
      params: { tag, origin },
    }).pipe(map(mapTemplate));
  }

  exists(tag: string, origin = ''): Observable<boolean> {
    return this.http.get(`${this.base}/exists`, {
      params: { tag, origin },
      responseType: 'text',
    }).pipe(map(v => v === 'true'));
  }

  page(args?: {
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
    return this.http.put<void>(this.base, writeTemplate(template));
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    });
  }
}
