/**
 * This file includes polyfills needed by testing environment.
 * It is loaded before tests run and includes test-specific mocks for jsdom.
 */

// Zone.js testing utilities (fakeAsync, tick, etc.)
import 'zone.js/testing';

// Mock CSS.supports for jsdom test environment
if (typeof CSS === 'undefined' || !CSS.supports) {
  (globalThis as any).CSS = {
    supports: () => true,
    ...(typeof CSS !== 'undefined' ? CSS : {})
  };
}

// Mock IntersectionObserver for jsdom test environment
if (typeof IntersectionObserver === 'undefined') {
  (globalThis as any).IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock HTMLCanvasElement.getContext for jsdom test environment
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype.getContext as any) = function(this: HTMLCanvasElement, contextType: string, ...args: any[]) {
    const ctx = originalGetContext.call(this, contextType, ...args);
    if (contextType === '2d' && !ctx) {
      // Return a minimal mock for 2d context when jsdom doesn't provide one
      return {
        canvas: this,
        fillText: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })
      };
    }
    return ctx;
  };
}
