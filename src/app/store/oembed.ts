import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, shareReplay, Subject, throwError } from 'rxjs';
import { Oembed } from '../model/oembed';
import { OEmbedService } from '../service/api/oembed.service';

@Injectable({
  providedIn: 'root'
})
export class OembedStore {
  private oembeds = inject(OEmbedService);


  private _cache = signal(new Map<string, Observable<Oembed | null>>());

  private loading: (() => void)[] = [];

  get cache() { return this._cache(); }
  set cache(value: Map<string, Observable<Oembed | null>>) { this._cache.set(value); }

  get(url: string, theme?: string, maxwidth?: number, maxheight?: number) {
    const key = `${url}-${theme}-${maxwidth}-${maxheight}`;
    const currentCache = this._cache();
    if (!currentCache.has(key)) {
      const sub = new Subject<Oembed | null>();
      const newCache = new Map(currentCache);
      newCache.set(key, sub.pipe(shareReplay(1)));
      this._cache.set(newCache);
      this.loading.push(() => this.oembeds.get(url, theme, maxwidth, maxheight).pipe(
        catchError(() => of(null)),
      ).subscribe(o => {
        sub.next(o);
        this.loading.shift();
        if (this.loading.length) this.loading[0]!();
      }));
      if (this.loading.length === 1) this.loading[0]!();
    }
    return this._cache().get(key)!.pipe(
      catchError(err => {
        if (err.status === 404) {
          const newCache = new Map(this._cache());
          newCache.delete(key);
          this._cache.set(newCache);
          return of({ url } as Oembed);
        }
        return throwError(() => err);
      }),
    );
  }
}
