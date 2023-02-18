import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as moment from 'moment/moment';
import { catchError, forkJoin, Observable, of, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Action, active } from '../model/plugin';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { RefService } from './api/ref.service';
import { TaggingService } from './api/tagging.service';

@Injectable({
  providedIn: 'root'
})
export class ActionService {

  constructor(
    private refs: RefService,
    private ts: TaggingService,
  ) { }

  apply(ref: Ref, a: Action) {
    const on = active(ref, a);
    if (a.tag) {
      const patch = (on ? '-' : '') + a.tag;
      return this.ts.create(patch, ref.url, ref.origin!);
    }
    if (a.response) {
      if (on) {
        return this.clearResponse(ref, a.response);
      } else {
        return this.clearResponse(ref, ...(a.clear || [])).pipe(
          switchMap(() => this.addResponse(ref, a.response!)));
      }
    }
    return of(null);
  }

  clearResponse(ref: Ref, ...tags: string[]): Observable<any> {
    if (!tags || !tags.length) return of(null);
    return forkJoin(tags.map(t => this.ts.deleteResponse(t, ref.url, ref.origin)));
  }

  addResponse(ref: Ref, tag: string): Observable<any> {
    return this.ts.createResponse(tag, ref.url, ref.origin);
  }
}
