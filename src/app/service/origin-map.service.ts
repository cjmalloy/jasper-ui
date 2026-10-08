import { Injectable } from '@angular/core';
import { uniq } from 'lodash-es';
import { runInAction } from 'mobx';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../model/ref';
import { isPushing, isReplicating } from '../mods/sync/origin';
import { AccountAlias } from '../store/origin';
import { Store } from '../store/store';
import { userAuthors } from '../util/format';
import { defaultOrigin, localTag, subOrigin, tagOrigin } from '../util/tag';
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
        this.store.origins.list = this.list;
        this.store.origins.lookup = this.lookup;
        this.store.origins.tunnelLookup = this.tunnelLookup;
        this.store.origins.reverseLookup = this.reverseLookup;
        this.store.origins.originMap = this.originMap;
        this.store.origins.accountAliases = this.accountAliases;
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
    return this.refs.page({ query: '+plugin/origin', page, size: this.config.fetchBatch, obsolete: null as any }).pipe(
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
  private get selfApis(): Map<string, string> {
    const config = (remote?: Ref): any => remote?.plugins?.['+plugin/origin'];
    const trimUrl = (url: string) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    return new Map([
      [this.api, this.store.account.origin],
      ...remotesForOrigin(this.store.account.origin)
        .filter(remote => isPushing(remote, ''))
        .map(remote => [trimUrl(remote.url), config(remote).remote]),
    ] as [string, string][]);
  }

  /**
   * Lists all visible origins.
   */
  private get list(): string[] {
    const config = (remote?: Ref): any => remote?.plugins?.['+plugin/origin'];
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    return uniq([
      this.store.account.origin,
      ...remotesForOrigin(this.store.account.origin)
        .map(remote => subOrigin(remote.origin, config(remote)?.local)),
    ]);
  }

  /**
   * Maps local-alias -> api.
   */
  private get lookup(): Map<string, string> {
    const config = (remote?: Ref): any => remote?.plugins?.['+plugin/origin'];
    const trimUrl = (url: string) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    return new Map([
      [this.store.account.origin, this.api],
      ...remotesForOrigin(this.store.account.origin)
        .map(remote => [subOrigin(remote.origin, config(remote)?.local), trimUrl(remote.url)]),
    ] as [string, string][]);
  }

  /**
   * Maps local-alias -> ssh user.
   */
  private get tunnelLookup(): Map<string, string> {
    const config = (remote?: Ref): any => remote?.plugins?.['+plugin/origin'];
    const tunnel = (remote: Ref): any => remote.plugins?.['+plugin/origin/tunnel'];
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    return new Map([
      [this.store.account.origin, this.api],
        ...remotesForOrigin(this.store.account.origin)
          .map(remote => [subOrigin(remote.origin, config(remote)?.local), {
            ...tunnel(remote),
            remoteUser: defaultOrigin(tunnel(remote)?.remoteUser || '', remote.origin),
          }]),
    ] as [string, string][]);
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
   * Includes nested origins and remote aliases that point back to this origin.
   */
  private get originMap(): Map<string, Map<string, string>> {
    const config = (remote: Ref): any => remote.plugins?.['+plugin/origin'];
    const me = this.store.account.origin || '';
    const selfApis = this.selfApis;
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => (remote.origin || '') === origin);
    const trimUrl = (url: string) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    const findLocalAlias = (url: string) => remotesForOrigin(me).find(remote => trimUrl(remote.url) === url);
    const resolve = (nested: Ref): string | undefined => {
      if (isReplicating(me, nested, selfApis)) return me;
      const alias = findLocalAlias(trimUrl(nested.url));
      return alias ? config(alias)?.local || '' : undefined;
    };
    const originMapFor = (origin: string): Map<string, string> => new Map(
      remotesForOrigin(origin)
        .map(nested => [config(nested)?.local || '', resolve(nested)])
        .filter(([, mapped]) => mapped !== undefined) as [string, string][]);
    const isSubOrigin = (origin: string) => origin !== me && (!me || origin.startsWith(me + '.'));
    return new Map(uniq([
      ...remotesForOrigin(me).map(remote => subOrigin(me, config(remote)?.local)),
      ...this.origins.map(remote => remote.origin || '').filter(isSubOrigin),
    ]).map(origin => [origin, originMapFor(origin)]));
  }

  /**
   * Account selector relationships normalized from this origin's perspective.
   * Aliases declared on local origin Refs are trusted. Aliases between remotes
   * are only accepted when both remotes declare the same link.
   */
  private get accountAliases(): AccountAlias[] {
    const config = (remote: Ref): any => remote.plugins?.['+plugin/origin'];
    const trimUrl = (url: string) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    const me = this.store.account.origin || '';
    const selfApis = this.selfApis;
    const localRemotes = this.origins.filter(remote => (remote.origin || '') === me);
    const target = (ref: Ref): string => {
      const from = ref.origin || '';
      if (from === me) return subOrigin(from, config(ref)?.local);
      if (isReplicating(me, ref, selfApis)) return me;
      const url = trimUrl(ref.url);
      const known = localRemotes.find(remote => trimUrl(remote.url) === url);
      if (known) return subOrigin(me, config(known)?.local);
      return subOrigin(from, config(ref)?.local);
    };
    const claims: Required<AccountAlias>[] = [];
    for (const ref of this.origins) {
      const from = ref.origin || '';
      const origin = target(ref);
      const aliases: string[] = uniq(config(ref)?.aliases || []);
      for (const author of userAuthors(ref)) {
        for (const alias of aliases) {
          if (!author || !alias) continue;
          claims.push({ from, origin, local: localTag(author), remote: localTag(alias) });
        }
      }
    }
    const result = claims.filter(c => {
      if (c.from === me) return true;
      if (c.origin === me) return false;
      return claims.some(o =>
        o.from === c.origin && o.origin === c.from &&
        o.local === c.remote && o.remote === c.local);
    });
    return uniq(result.map(alias => JSON.stringify(alias))).map(alias => JSON.parse(alias));
  }

  aliasesFor(selector: string, origin?: string): string[] {
    const local = localTag(selector);
    const from = selector.includes('@') ? tagOrigin(selector) : this.store.account.origin || '';
    return uniq(this.store.origins.accountAliases
      .filter(alias => (alias.from || '') === from)
      .filter(alias => origin === undefined || alias.origin === origin)
      .filter(alias => selectorMatches(alias.local, local))
      .map(alias => alias.remote + local.substring(alias.local.length) + alias.origin));
  }

  isCurrentAccountRef(ref: Ref, selector = this.store.account.tag): boolean {
    const origin = ref.origin || '';
    const selectors = origin === (this.store.account.origin || '')
      ? [localTag(selector)]
      : this.aliasesFor(selector, origin).map(localTag);
    return userAuthors(ref).some(author =>
      selectors.some(candidate => selectorMatches(candidate, localTag(author))));
  }
}

export function selectorMatches(selector: string, candidate: string): boolean {
  return candidate === selector || candidate.startsWith(selector + '/');
}
