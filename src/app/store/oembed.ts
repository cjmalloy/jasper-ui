import { computed, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, shareReplay, Subject, throwError } from 'rxjs';
import { Oembed } from '../model/oembed';
import { OEmbedService } from '../service/api/oembed.service';

@Injectable({
  providedIn: 'root'
})
export class OembedStore {

  private _cache = signal(new Map<string, Observable<Oembed | null>>());
  private _loading = signal<(() => void)[]>([]);

  // Backwards compatible getters/setters
  get cache() { return this._cache(); }
  set cache(value: Map<string, Observable<Oembed | null>>) { this._cache.set(value); }

  get loading() { return this._loading(); }
  private set loading(value: (() => void)[]) { this._loading.set(value); }

  // New signal-based API
  cache$ = computed(() => this._cache());
  loading$ = computed(() => this._loading());

  constructor(
    private oembeds: OEmbedService,
  ) {
    // No initialization needed with signals
  }

  get(url: string, theme?: string, maxwidth?: number, maxheight?: number) {
    const key = `${url}-${theme}-${maxwidth}-${maxheight}`;
    if (!this.cache.has(key)) {
      const sub = new Subject<Oembed | null>();
      this.cache.set(key, sub.pipe(shareReplay(1)));
      const currentLoading = this.loading;
      currentLoading.push(() => this.oembeds.get(url, theme, maxwidth, maxheight).pipe(
        catchError(() => of(null)),
      ).subscribe(o => {
        sub.next(o);
        // Update loading signal
        const newLoading = this.loading;
        newLoading.shift();
        this.loading = newLoading;
        if (newLoading.length) newLoading[0]!();
      }));
      this.loading = currentLoading;
      if (currentLoading.length === 1) currentLoading[0]!();
    }
    return this.cache.get(key)!.pipe(
      catchError(err => {
        if (err.status === 404) {
          this.cache.delete(key);
          return of({ url } as Oembed);
        }
        return throwError(() => err);
      }),
    );
  }

}
