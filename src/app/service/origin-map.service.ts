import { Injectable } from '@angular/core';
import { runInAction } from 'mobx';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { isPushing, isReplicating } from '../mods/plugin/origin';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { RefService } from './api/ref.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class OriginMapService {

  private origins: Ref[] = [];

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private refs: RefService,
    private store: Store,
  ) { }

  get init$() {
    this.origins = [];
    if (!this.admin.status.plugins.origin) return of(null);
    return this.loadOrigins$().pipe(
      tap(() => runInAction(() => {
        this.store.origins.origins = this.origins;
        this.store.origins.reverseLookup = this.reverseLookup;
        this.store.origins.originMap = this.originMap;
      })),
      catchError(err => {
        console.error("Error looking up origin cross references.");
        console.error(err);
        return of(null)
      }),
    );
  }

  private loadOrigins$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxOrigins) {
      console.error(`Too many origins to load, only loaded ${alreadyLoaded}. Increase maxOrigins to load more.`)
      return of(null);
    }
    return this.refs.page({query: '+plugin/origin', page, size: this.config.fetchBatch}).pipe(
      tap(batch => this.origins.push(...batch.content)),
      switchMap(batch => batch.last ? of(null) : this.loadOrigins$(page + 1)),
    );
  }

  private get selfApis(): Map<string, string> {
    return new Map([
      [this.store.account.origin, this.config.api],
      ...this.origins
      .filter(remote => isPushing(remote, this.store.account.origin))
      .map(remote => [remote.plugins?.['+plugin/origin']?.remote || '', remote.url] as [string, string]),
    ]);
  }

  private get reverseLookup(): Map<string, string> {
    return new Map(this.origins
      .filter(remote => isReplicating(remote, this.selfApis))
      .map(remote => [remote.origin || '', remote.plugins?.['+plugin/origin']?.local]));
  }

  private get originMap(): Map<string, Map<string, string>> {
    const config = (remote: Ref): any => remote.plugins?.['+plugin/origin'];
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    const findLocalAlias = (url: string) => remotesForOrigin(this.store.account.origin)
      .filter(remote => remote.url === url)
      .map(remote => config(remote)?.local || '')
      .find(() => true) || '';
    const originMapFor = (origin: string) => new Map(
      remotesForOrigin(origin)
        .map(remote => [config(remote)?.local || '', findLocalAlias(remote.url)]));
    return new Map(
      remotesForOrigin(this.store.account.origin || '')
        .map(remote => remote.origin || '')
        .map(origin => [origin, originMapFor(origin)]));
  }
}
