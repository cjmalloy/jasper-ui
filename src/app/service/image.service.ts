import { Injectable } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { Resource } from '../model/resource';
import { getSearchParams } from '../util/http';
import { ProxyService } from './api/proxy.service';

export interface Dim {
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

  async getImage(url: string): Promise<Dim> {
    return this.cache.get(url) || this.loadUrl(url);
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
