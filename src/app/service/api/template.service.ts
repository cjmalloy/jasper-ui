import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { mapPage, Page } from '../../model/page';
import { TagPageArgs } from '../../model/tag';
import { mapTemplate, Template, writeTemplate } from '../../model/template';
import { params } from '../../util/http';
import { OpPatch } from '../../util/json-patch';
import { ConfigService } from '../config.service';
import { LoginService } from '../login.service';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private login = inject(LoginService);


  private get base() {
    return this.config.api + '/api/v1/template';
  }

  create(template: Template): Observable<void> {
    if (template.tag.startsWith('/')) template.tag = template.tag.substring(1);
    return this.http.post<void>(this.base, writeTemplate(template)).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  get(tag = ''): Observable<Template> {
    if (tag.startsWith('/')) tag = tag.substring(1);
    return this.http.get(this.base, {
      params: { tag },
    }).pipe(
      map(mapTemplate),
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  page(args?: TagPageArgs): Observable<Page<Template>> {
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

  patch(tag: string, cursor: string, patch: OpPatch[]): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/json-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  merge(tag: string, cursor: string, patch: Partial<Template>): Observable<string> {
    return this.http.patch<string>(this.base, patch, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      params: params({ tag, cursor }),
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }

  delete(tag: string): Observable<any> {
    if (tag.startsWith('/')) tag = tag.substring(1);
    return this.http.delete<void>(this.base, {
      params: { tag },
    }).pipe(
      catchError(err => this.login.handleHttpError(err)),
    );
  }
}
