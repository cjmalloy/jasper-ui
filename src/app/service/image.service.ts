import { Injectable } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { Resource } from '../model/resource';
import { getSearchParams } from '../util/http';
import { ProxyService } from './api/proxy.service';

export interface Dim {
  url?: string,
  width: number;
  height: number;
}

export function height(width: number, ar: Dim) {
  return width * ar.height / ar.width;
}

export function width(height: number, ar: Dim) {
  return height * ar.width / ar.height;
}

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private cache = new Map<string, Dim>();

  constructor(
    private proxy: ProxyService,
  ) { }

  async getImage(url: string): Promise<Dim> {
    if (this.proxy.isProxied(url)) {
      const params = getSearchParams(url);
      return firstValueFrom(this.proxy.fetch(params.get('url')!, params.get('thumbnail') === 'true' || undefined).pipe(
        map(res => this.loadRes(res)),
      ));
    }
    return this.cache.get(url) || this.loadUrl(url);
  }

  private async loadRes(res: Resource): Promise<Dim> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(new Blob([res.data!], {type: res.mimeType!}));
      image.src = url;
      image.onload = () => {
        const dim = {
          url,
          width: image.width,
          height: image.height,
        };
        this.cache.set(res.url!, dim);
        resolve(dim);
      }
      image.onerror = (event) => reject(event);
    });
  }

  private async loadUrl(url: string): Promise<Dim> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        const dim = {
          width: image.width,
          height: image.height,
        };
        this.cache.set(url, dim);
        resolve(dim);
      }
      image.onerror = (event) => reject(event);
    });
  }
}
