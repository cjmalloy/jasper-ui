import { Injectable } from '@angular/core';

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

  private cache = new Map<string, Promise<Dim>>();

  getImage(url: string): Promise<Dim> {
    if (!this.cache.has(url)) {
      this.cache.set(url, this.loadUrl(url));
    }
    return this.cache.get(url)!;
  }

  private loadUrl(url: string): Promise<Dim> {
    const promise = new Promise<Dim>((resolve, reject) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        resolve({
          width: image.width,
          height: image.height,
        });
      };
      image.onerror = (event) => reject(event);
    });
    promise.catch(() => this.cache.delete(url));
    return promise;
  }
}
