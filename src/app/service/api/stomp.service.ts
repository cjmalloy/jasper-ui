import { Injectable, isDevMode } from '@angular/core';
import { RxStomp, RxStompConfig } from '@stomp/rx-stomp';
import { map, Observable, takeWhile, timeInterval } from 'rxjs';
import { Ext, mapExt } from '../../model/ext';
import { mapRef, RefUpdates } from '../../model/ref';
import { Store } from '../../store/store';
import { isSubOrigin, localTag, tagOrigin } from '../../util/tag';
import { ConfigService } from '../config.service';

export const EXT_UPDATE_RATE_LIMIT_MS = 60 * 1000;

function isTestEnvironment(): boolean {
  // Check for Vitest/Jest test environment
  // @ts-ignore
  if (typeof globalThis !== 'undefined' && (globalThis.__vitest_worker__ || globalThis.jest)) return true;
  // Check for Zone.js test zone (Angular TestBed)
  // @ts-ignore
  if (typeof Zone !== 'undefined' && Zone.current?.name === 'ProxyZone') return true;
  return false;
}

@Injectable({
  providedIn: 'root'
})
export class StompService extends RxStomp {

  private stompConfig: RxStompConfig;

  constructor(
    private config: ConfigService,
    private store: Store,
  ) {
    super();
    this.stompConfig = {
      brokerURL: this.brokerURL,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 0,
      reconnectDelay: 2000,
    };
    if (isDevMode()) {
      this.stompConfig.debug = (msg: string) => console.debug('📶️  '+ msg);
    }
    this.configure(this.stompConfig);
    if (this.config.websockets && !isTestEnvironment()) this.activate();
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
    const api = this.config.api || '.';
    var proto = this.getWsProtocol(api);
    if (api === '.' || api === '/' || api === './') return proto + location.host;
    if (api.startsWith('//')) return proto + api.substring('//'.length);
    if (api.startsWith('https://')) return proto + api.substring('https://'.length);
    if (api.startsWith('http://')) return proto + api.substring('http://'.length);
    return proto + api;
  }

  getWsProtocol(url = '') {
    return url.startsWith('https:') ? 'wss://' :
           url.startsWith('http:') ? 'ws://' :
           location.protocol === 'https:' ? 'wss://' :
           'ws://';
  }

  watchOrigin(origin: string): Observable<string> {
    return this.watch('/topic/cursor/' + (origin || 'default'), this.headers).pipe(
      map(m => m.body),
    );
  }

  watchRef(url: string, origin?: string): Observable<RefUpdates> {
    origin = (origin === undefined ? this.store.account.origin : origin) || 'default';
    return this.watch('/topic/ref/' + origin + '/' + encodeURIComponent(url), this.headers).pipe(
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
      timeInterval(),
      takeWhile((update, index) => index === 0 || update.interval >= EXT_UPDATE_RATE_LIMIT_MS),
      map(({ value }) => mapExt(JSON.parse(value.body))),
    );
  }
}
