import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { mapTemplate, maybeTemplate, Template, writeTemplate } from '../../model/template';
import { params } from '../../util/http';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {

  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private login: LoginService,
  ) { }

  private get base() {
    return this.config.api + '/api/v1/template';
  }

  create(template: Template): Observable<void> {
    return this.http.post<void>(this.base, writeTemplate(template)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag = ''): Observable<Template> {
    return this.http.get(this.base, {
      params: params({ tag }),
    }).pipe(
      map(mapTemplate),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  exists(tag: string): Observable<boolean> {
    return this.http.get(`${this.base}/exists`, {
      params: { tag },
      responseType: 'text',
    }).pipe(
      map(v => v === 'true'),
      catchError(err => this.login.handleHttpError(err)),
      catchError(err => of(false)),
    );
  }

  list(tags: string[]): Observable<(Template | undefined)[]> {
    return this.http.get(`${this.base}/list`, {
      params: params({ tags }),
    }).pipe(
      map(res => res as any[]),
      map(res => res.map(maybeTemplate)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args?: {
    query?: string,
    page?: number,
    size?: number,
    sort?: string,
    direction?: 'asc' | 'desc',
  }): Observable<Page<Template>> {
    return this.http.get(`${this.base}/page`, {
      params: params(args),
    }).pipe(
      map(mapPage(mapTemplate)),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  update(template: Template): Observable<void> {
    return this.http.put<void>(this.base, writeTemplate(template)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string): Observable<void> {
    return this.http.delete<void>(this.base, {
      params: { tag },
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
