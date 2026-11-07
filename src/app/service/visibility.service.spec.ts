/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { VisibilityService } from './visibility.service';

describe('VisibilityService', () => {
  let service: VisibilityService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({});
    service = TestBed.inject(VisibilityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('notifies every callback for the same element', () => {
    let notify!: IntersectionObserverCallback;
    const observe = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: IntersectionObserverCallback) { notify = cb; }
      observe = observe;
      unobserve = vi.fn();
    });
    try {
      const s = new VisibilityService();
      const el = document.createElement('span');
      const a = vi.fn();
      const b = vi.fn();
      s.notifyVisible(new ElementRef(el), a);
      s.notifyVisible(new ElementRef(el), b);
      expect(observe).toHaveBeenCalledTimes(1);
      notify([{ target: el, isIntersecting: true } as any], {} as any);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('disposes callbacks', () => {
    let notify!: IntersectionObserverCallback;
    const unobserve = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: IntersectionObserverCallback) { notify = cb; }
      observe = vi.fn();
      unobserve = unobserve;
    });
    try {
      const s = new VisibilityService();
      const el = document.createElement('span');
      const a = vi.fn();
      const b = vi.fn();
      const disposeA = s.notifyVisible(new ElementRef(el), a);
      const disposeB = s.notifyVisible(new ElementRef(el), b);
      disposeA();
      expect(unobserve).not.toHaveBeenCalled();
      notify([{ target: el, isIntersecting: true } as any], {} as any);
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
      disposeB();

      const c = vi.fn();
      s.notifyVisible(new ElementRef(el), c)();
      expect(unobserve).toHaveBeenCalledTimes(2);
      notify([{ target: el, isIntersecting: true } as any], {} as any);
      expect(c).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
