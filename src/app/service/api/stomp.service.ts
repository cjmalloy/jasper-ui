import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { map, Observable } from 'rxjs';
import { Ext, mapExt } from '../../model/ext';
import { mapRef, RefUpdates } from '../../model/ref';
import { Store } from '../../store/store';
import { isSubOrigin, localTag, tagOrigin } from '../../util/tag';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root'
})
export class StompService extends RxStomp {

  constructor(
    private config: ConfigService,
    private store: Store,
  ) {
    super();
    this.configure({
      brokerURL: this.brokerURL,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 0,
      reconnectDelay: 2000,
    });
    if (this.config.websockets) this.activate();
  }

  get headers() {
    return {
      jwt: this.config.token,
    };
  }

  get brokerURL() {
    return `${this.hostUrl}/api/stomp/websocket`
  }

  get hostUrl() {
    if (this.config.api.startsWith('//')) return 'ws://' + this.config.api.substring('//'.length);
    if (this.config.api.startsWith('https://')) return 'wss://' + this.config.api.substring('https://'.length);
    if (this.config.api.startsWith('http://')) return 'ws://' + this.config.api.substring('http://'.length);
    return 'ws://' + this.config.api;
  }

  watchOrigin(origin: string): Observable<string> {
    return this.watch('/topic/cursor/' + (origin || 'default'), this.headers).pipe(
      map(m => m.body),
    );
  }

  watchRef(url: string): Observable<RefUpdates> {
    return this.watch('/topic/ref/' + (this.store.account.origin || 'default') + '/' + encodeURIComponent(url), this.headers).pipe(
      map(m => mapRef(JSON.parse(m.body))),
    );
  }

  watchTag(tag: string): Observable<string> {
    const origin = isSubOrigin(this.store.account.origin, tagOrigin(tag)) ? tagOrigin(tag) : this.store.account.origin;
    return this.watch('/topic/tag/' + (origin || 'default') + '/' + encodeURIComponent(localTag(tag)), this.headers).pipe(
      map(m => m.body as string),
    );
  }

  watchResponse(url: string): Observable<string> {
    return this.watch('/topic/response/' + (this.store.account.origin || 'default') + '/' + encodeURIComponent(url), this.headers).pipe(
      map(m => m.body as string),
    );
  }

  watchExt(tag: string): Observable<Ext> {
    return this.watch('/topic/ext/' + (tagOrigin(tag) || this.store.account.origin || 'default') + '/' + encodeURIComponent(localTag(tag)), this.headers).pipe(
      map(m => mapExt(JSON.parse(m.body))),
    );
  }
}
