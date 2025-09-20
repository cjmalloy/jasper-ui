import { Injectable, isDevMode } from '@angular/core';
import { RxStomp, RxStompConfig } from '@stomp/rx-stomp';
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

  private stompConfig: RxStompConfig = {
    brokerURL: this.brokerURL,
    heartbeatIncoming: 20000,
    heartbeatOutgoing: 0,
    reconnectDelay: 2000,
  };
  constructor(
    private config: ConfigService,
    private store: Store,
  ) {
    super();
    if (isDevMode()) {
      this.stompConfig.debug = msg => console.debug('📶️  '+ msg);
    }
    this.configure(this.stompConfig);
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
    var proto = this.getWsProtocol(this.config.api);
    if (this.config.api === '.' || this.config.api === '/' || this.config.api === './') return proto + location.host;
    if (this.config.api.startsWith('//')) return proto + this.config.api.substring('//'.length);
    if (this.config.api.startsWith('https://')) return proto + this.config.api.substring('https://'.length);
    if (this.config.api.startsWith('http://')) return proto + this.config.api.substring('http://'.length);
    return proto + this.config.api;
  }

  getWsProtocol(url = '') {
    return url.startsWith('https:') ? 'wss://' :
           url.startsWith('http:') ? 'ws://' :
           location.protocol === 'https:' ? 'wss://' :
           'ws://';
  }

  origin$(origin: string): Observable<string> {
    return this.watch('/topic/cursor/' + (origin || 'default'), this.headers).pipe(
      map(m => m.body),
    );
  }

  ref$(url: string): Observable<RefUpdates> {
    return this.watch('/topic/ref/' + (this.store.account.origin || 'default') + '/' + encodeURIComponent(url), this.headers).pipe(
      map(m => mapRef(JSON.parse(m.body))),
    );
  }

  refOnOrigin$(url: string, origin: string): Observable<RefUpdates> {
    return this.watch('/topic/ref/' + (origin || 'default') + '/' + encodeURIComponent(url), this.headers).pipe(
      map(m => mapRef(JSON.parse(m.body))),
    );
  }

  tag$(tag: string): Observable<string> {
    const origin = isSubOrigin(this.store.account.origin, tagOrigin(tag)) ? tagOrigin(tag) : this.store.account.origin;
    return this.watch('/topic/tag/' + (origin || 'default') + '/' + encodeURIComponent(localTag(tag)), this.headers).pipe(
      map(m => m.body as string),
    );
  }

  response$(url: string): Observable<string> {
    return this.watch('/topic/response/' + (this.store.account.origin || 'default') + '/' + encodeURIComponent(url), this.headers).pipe(
      map(m => m.body as string),
    );
  }

  ext$(tag: string): Observable<Ext> {
    return this.watch('/topic/ext/' + (tagOrigin(tag) || this.store.account.origin || 'default') + '/' + encodeURIComponent(localTag(tag)), this.headers).pipe(
      map(m => mapExt(JSON.parse(m.body))),
    );
  }
}
