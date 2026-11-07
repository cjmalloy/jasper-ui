import { ElementRef, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VisibilityService {
  private observer?: IntersectionObserver;
  private observedElements = new Map<Element, (() => void)[]>();

  constructor() {
    if (('IntersectionObserver' in window)) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cbs = this.observedElements.get(entry.target);
            if (cbs) {
              this.observer!.unobserve(entry.target);
              this.observedElements.delete(entry.target);
              cbs.forEach(cb => cb());
            }
          }
        }, {
          rootMargin: '200px'
        });
      });
    }
  }

  public notifyVisible(element: ElementRef, callback: () => void) {
    if (!('IntersectionObserver' in window)) {
      // Fallback for unsupported browsers
      callback();
      return;
    }
    const cbs = this.observedElements.get(element.nativeElement);
    if (cbs) {
      cbs.push(callback);
      return;
    }
    this.observer!.observe(element.nativeElement);
    this.observedElements.set(element.nativeElement, [callback]);
  }
}
