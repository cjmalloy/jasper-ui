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

  /**
   * Call back once when the element is close to the viewport.
   * @return disposer that cancels the callback
   */
  public notifyVisible(element: ElementRef, callback: () => void): () => void {
    if (!('IntersectionObserver' in window)) {
      // Fallback for unsupported browsers
      callback();
      return () => {};
    }
    const el = element.nativeElement as Element;
    const cbs = this.observedElements.get(el);
    if (cbs) {
      cbs.push(callback);
    } else {
      this.observer!.observe(el);
      this.observedElements.set(el, [callback]);
    }
    return () => {
      const cbs = this.observedElements.get(el);
      if (!cbs) return;
      const i = cbs.indexOf(callback);
      if (i >= 0) cbs.splice(i, 1);
      if (cbs.length) return;
      this.observer!.unobserve(el);
      this.observedElements.delete(el);
    };
  }
}
