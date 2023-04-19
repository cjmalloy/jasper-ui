import { Injectable } from '@angular/core';
import { makeAutoObservable, observable } from 'mobx';
import { Observable, shareReplay } from 'rxjs';
import { Oembed } from '../model/oembed';
import { OEmbedService } from '../service/api/oembed.service';

@Injectable({
  providedIn: 'root'
})
export class OembedStore {

  cache = new Map<string, Observable<Oembed>>();

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
        shareReplay(1),
      ));
    }
    return this.cache.get(key)!;
  }

}
