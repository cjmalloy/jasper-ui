import { Injectable } from '@angular/core';
import { without } from 'lodash-es';
import { Action, active, EventAction, ResponseAction, TagAction } from '../model/plugin';
import { Ref } from '../model/ref';
import { Store } from '../store/store';
import { OriginService } from './api/origin.service';
import { RefService } from './api/ref.service';
import { ScrapeService } from './api/scrape.service';
import { TaggingService } from './api/tagging.service';

@Injectable({
  providedIn: 'root'
})
export class ActionService {

  constructor(
    private refs: RefService,
    private tags: TaggingService,
    private scraper: ScrapeService,
    private origins: OriginService,
    private store: Store,
  ) { }

  apply(ref: Ref, a: Action) {
    if ('tag' in a) {
      return this.tag(ref, a);
    }
    if ('response' in a) {
      return this.respond(ref, a);
    }
    if ('event' in a) {
      return this.event(ref, a);
    }
    throw 'Invalid action';
  }

  event(ref: Ref, a: EventAction) {
    this.store.eventBus.fire(a.event, ref);
  }

  tag(ref: Ref, a: TagAction) {
    const on = active(ref, a);
    const patch = (on ? '-' : '') + a.tag;
    this.store.eventBus.runAndReload(this.tags.create(patch, ref.url, ref.origin), ref);
  }

  respond(ref: Ref, a: ResponseAction) {
    const on = active(ref, a);
    if (on) {
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls = without(ref.metadata.userUrls, a.response);
      this.store.eventBus.runAndRefresh(this.tags.deleteResponse(a.response, ref.url), ref);
    } else {
      const clear = (a.clear || []).map(t => '-' + t);
      const tags = [
        ...clear,
        a.response,
      ];
      ref.metadata ||= {};
      ref.metadata.userUrls ||= [];
      ref.metadata.userUrls.push(a.response);
      ref.metadata.userUrls = without(ref.metadata.userUrls, ...clear);
      this.store.eventBus.runAndRefresh(this.tags.respond(tags, ref.url), ref);
    }
  }
}
