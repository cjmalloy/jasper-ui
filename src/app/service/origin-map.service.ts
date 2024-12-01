import { Injectable } from '@angular/core';
import { runInAction } from 'mobx';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { isPushing, isReplicating } from '../mods/origin';
import { Store } from '../store/store';
import { subOrigin } from '../util/tag';
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
    if (!this.admin.getPlugin('+plugin/origin')) return of(null);
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
    return this.refs.page({ query: '+plugin/origin', page, size: this.config.fetchBatch, obsolete: true }).pipe(
      tap(batch => this.origins.push(...batch.content)),
      switchMap(batch => !batch.content.length ? of(null) : this.loadOrigins$(page + 1)),
    );
  }

  private get api() {
    if (this.config.api.startsWith('//')) {
      return location.protocol + this.config.api;
    }
    return this.config.api;
  }

  /**
   * Searches push configs to list api aliases.
   */
  private get selfApis(): Set<string> {
    const trimUrl = (url: string) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    return new Set([this.api,
      ...remotesForOrigin(this.store.account.origin)
        .filter(remote => isPushing(remote, ''))
        .map(remote => trimUrl(remote.url)),
    ]);
  }

  /**
   * Maps local-alias -> remote-alias-to-self.
   */
  private get reverseLookup(): Map<string, string> {
    const config = (remote?: Ref): any => remote?.plugins?.['+plugin/origin'];
    return new Map(this.origins
      .filter(remote => isReplicating(this.store.account.origin || '', remote, this.selfApis))
      .filter(remote => config(remote)?.local)
      .map(remote => [remote.origin || '', config(remote)?.local]));
  }

  /**
   * Maps local-alias -> remote-alias -> local-alias.
   */
  private get originMap(): Map<string, Map<string, string>> {
    const config = (remote: Ref): any => remote.plugins?.['+plugin/origin'];
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    const trimUrl = (url: string) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    const findLocalAlias = (url: string) => remotesForOrigin(this.store.account.origin)
      .filter(remote => trimUrl(remote.url) === url)
      [0] || undefined;
    const originMapFor = (remote: Ref): Map<string, string> => new Map(
      remotesForOrigin(subOrigin(this.store.account.origin, config(remote)?.local))
        .filter(nested => findLocalAlias(trimUrl(nested.url)) !== undefined)
        .map(nested => [
          config(nested)?.local || '',
          config(findLocalAlias(trimUrl(nested.url))!)?.local || ''
        ]));
    return new Map(
      remotesForOrigin(this.store.account.origin || '')
        .map(remote => [
          subOrigin(this.store.account.origin, config(remote)?.local),
          originMapFor(remote)
        ]));
  }
}
