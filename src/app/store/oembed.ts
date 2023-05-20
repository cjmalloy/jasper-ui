import { Injectable } from '@angular/core';
import { makeAutoObservable, observable } from 'mobx';
import { catchError, Observable, of, shareReplay } from 'rxjs';
import { Oembed } from '../model/oembed';
import { OEmbedService } from '../service/api/oembed.service';

@Injectable({
  providedIn: 'root'
})
export class OembedStore {

  cache = new Map<string, Observable<Oembed | null>>();

  constructor(
    private oembeds: OEmbedService,
  ) {
    makeAutoObservable(this, {
      cache: observable.shallow,
    });
  }

  get(url: string, theme?: string, maxwidth?: number, maxheight?: number) {
    const key = `${url}-${theme}-${maxwidth}-${maxheight}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, this.oembeds.get(url, theme, maxwidth, maxheight).pipe(
        catchError(() => of(null)),
        shareReplay(1),
      ));
    }
    return this.cache.get(key)!;
  }

}
