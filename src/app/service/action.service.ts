import { Injectable } from '@angular/core';
import * as moment from 'moment/moment';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
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
    private store: Store,
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
    return this.refs.page({
      responses: ref.url,
      query: `(${tags.join('|')}):${this.store.account.localTag}`,
    }).pipe(
      switchMap(page => page.empty ? of(null) :
        forkJoin([
          ...page.content.map(c => this.refs.delete(c.url)),
          ...(page.last ? [] : [this.clearResponse(ref, ...tags)])]))
    );
  }

  addResponse(ref: Ref, tag: string): Observable<any> {
    return this.refs.create({
      url: 'internal:' + uuid(),
      published: moment(),
      tags: ['internal', this.store.account.localTag, tag],
      sources: [ref.url],
    });
  }
}
