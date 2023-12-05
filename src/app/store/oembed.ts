import { Injectable } from '@angular/core';
import { action, makeObservable, observable, runInAction } from 'mobx';
import { catchError, Observable, of, shareReplay, Subject } from 'rxjs';
import { Oembed } from '../model/oembed';
import { OEmbedService } from '../service/api/oembed.service';

@Injectable({
  providedIn: 'root'
})
export class OembedStore {

  @observable.ref
  cache = new Map<string, Observable<Oembed | null>>();

  private loading: (() => void)[] = [];

  constructor(
    private oembeds: OEmbedService,
  ) {
    makeObservable(this);
  }

  @action
  get(url: string, theme?: string, maxwidth?: number, maxheight?: number) {
    const key = `${url}-${theme}-${maxwidth}-${maxheight}`;
    if (!this.cache.has(key)) {
      const sub = new Subject<Oembed | null>();
      this.cache.set(key, sub.pipe(shareReplay(1)));
      this.loading.push(() => this.oembeds.get(url, theme, maxwidth, maxheight).pipe(
        catchError(() => of(null)),
      ).subscribe(o => {
        sub.next(o);
        runInAction(() => this.loading.shift());
        if (this.loading.length) this.loading[0]!();
      }));
      if (this.loading.length === 1) this.loading[0]!();
    }
    return this.cache.get(key)!;
  }

}
