import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { Action, active } from '../model/plugin';
import { Ref } from '../model/ref';
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
        return this.ts.deleteResponse(a.response, ref.url);
      } else {
        const tags = [
          ...(a.clear || []).map(t => '-' + t),
          a.response,
        ];
        return this.ts.respond(tags, ref.url);
      }
    }
    return of(null);
  }
}
