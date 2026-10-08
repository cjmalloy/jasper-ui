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
import { defaultOrigin, hasTag, localTag, removeParentOrigin, subOrigin, tagOrigin } from '../util/tag';
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
      [trimUrl(this.api), this.store.account.origin],
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
   * Values are relative to this origin, with the empty string meaning this origin.
   *
   * Origin configs are interpreted in the context of the origin they were pulled into.
   * When an origin mirrors one of our own origins (it was pulled from the same url + remote
   * that we push to or pull from), our configs for that origin are used. Configs found
   * directly in a sub-origin are only used as advice.
   */
  private get originMap(): Map<string, Map<string, string>> {
    const config = (remote: Ref): any => remote.plugins?.['+plugin/origin'];
    const me = this.store.account.origin || '';
    const selfApis = this.selfApis;
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => (remote.origin || '') === origin);
    const isSubOrigin = (origin: string) => origin !== me && (!me || origin.startsWith(me + '.'));
    const ancestors = (origin: string) => {
      const result = [me];
      const rest = me ? origin.substring(me.length + 1) : origin.substring(1);
      const parts = rest.split('.');
      for (let i = 1; i < parts.length; i++) result.push(subOrigin(me, '@' + parts.slice(0, i).join('.')));
      return result;
    };
    const cache = new Map<string, Ref[]>();
    const configsFor = (origin: string): Ref[] => {
      if (cache.has(origin)) return cache.get(origin)!;
      const advice = remotesForOrigin(origin);
      if (!isSubOrigin(origin)) return advice;
      const mirrors = new Set<string>();
      for (const parent of ancestors(origin)) {
        for (const puller of configsFor(parent)) {
          if (!hasTag('+plugin/origin/pull', puller)) continue;
          if (subOrigin(parent, config(puller)?.local) !== origin) continue;
          const mirror = this.mirrorOf(puller, selfApis);
          if (mirror !== undefined && mirror !== origin) mirrors.add(mirror);
        }
      }
      const result = uniq([...advice, ...[...mirrors].flatMap(remotesForOrigin)]);
      cache.set(origin, result);
      return result;
    };
    const relative = (origin: string) => origin === me ? '' : removeParentOrigin(origin, me);
    return new LazyMap(origin => new Map(configsFor(origin)
      .filter(remote => !hasTag('+plugin/origin/push', remote))
      .map(remote => [config(remote)?.local || '', this.mirrorOf(remote, selfApis)])
      .filter(([local, mirror]) => local && mirror !== undefined)
      .map(([local, mirror]) => [local, relative(mirror!)]) as [string, string][]));
  }

  /**
   * Finds which of our origins a remote origin Ref points to by matching url + remote
   * against our own origin configs.
   */
  private mirrorOf(ref: Ref, selfApis = this.selfApis): string | undefined {
    const config = (remote: Ref): any => remote.plugins?.['+plugin/origin'];
    const trimUrl = (url: string) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    const me = this.store.account.origin || '';
    if (isReplicating(me, ref, selfApis)) return me;
    const url = trimUrl(ref.url);
    const remote = config(ref)?.remote || '';
    const known = this.origins.find(r =>
      (r.origin || '') === me &&
      trimUrl(r.url) === url &&
      (config(r)?.remote || '') === remote);
    if (known) return subOrigin(me, config(known)?.local);
    return undefined;
  }

  /**
   * Account selector relationships normalized from this origin's perspective.
   * Aliases declared on local origin Refs are trusted. Aliases between remotes
   * are only accepted when both remotes declare the same link.
   */
  private get accountAliases(): AccountAlias[] {
    const config = (remote: Ref): any => remote.plugins?.['+plugin/origin'];
    const me = this.store.account.origin || '';
    const selfApis = this.selfApis;
    const target = (ref: Ref): string => {
      const from = ref.origin || '';
      if (from === me) return subOrigin(from, config(ref)?.local);
      return this.mirrorOf(ref, selfApis) ?? subOrigin(from, config(ref)?.local);
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

/**
 * Map that computes and caches entries on first access.
 */
class LazyMap<V> extends Map<string, V> {
  constructor(private compute: (key: string) => V) {
    super();
  }

  override get(key: string): V | undefined {
    if (!super.has(key)) super.set(key, this.compute(key));
    return super.get(key);
  }

  override has(key: string): boolean {
    const value: any = this.get(key);
    return value !== undefined && (!(value instanceof Map) || value.size > 0);
  }
}
