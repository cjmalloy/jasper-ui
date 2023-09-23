import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { map, Observable } from 'rxjs';
import { mapRef, Ref } from '../../model/ref';
import { AuthnService } from '../authn.service';
import { ConfigService } from '../config.service';

@Injectable({
  providedIn: 'root'
})
export class StompService extends RxStomp {

  constructor(
    private config: ConfigService,
    private auth: AuthnService,
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
      jwt: this.auth.token,
    };
  }

  get brokerURL() {
    if (this.config.api.startsWith('//')) return 'ws://' + this.config.api.substring('//'.length) + '/websocket'
    if (this.config.api.startsWith('https://')) return 'wss://' + this.config.api.substring('https://'.length) + '/websocket';
    if (this.config.api.startsWith('http://')) return 'ws://' + this.config.api.substring('http://'.length) + '/websocket';
    return 'ws://' + this.config.api + '/websocket'
  }

  watchRef(url: string, origins?: (string | undefined)[]): Observable<Ref>[] {
    return (origins || ['']).map(origin => this.watch('/topic/ref/' + (origin || 'default') + '/' + url, this.headers).pipe(
      map(m => mapRef(JSON.parse(m.body))),
    ));
  }

  watchTag(tag: string): Observable<string> {
    // TODO: workaround +_ in destination
    return this.watch('/topic/tag/' + tag.replace('_', '>').replace('+', '<'), this.headers).pipe(
      map(m => m.body as string),
    );
  }
}
