/// <reference types="vitest/globals" />
import { resizeStart, resizeToPointer } from './resize';

describe('resizeToPointer', () => {
  function centered(container: number, width: number, height: number) {
    const el = document.createElement('div');
    const size = { width, height };
    el.getBoundingClientRect = () => {
      const left = Math.max(0, (container - size.width) / 2);
      return { left, top: 0, right: left + size.width, bottom: size.height, width: size.width, height: size.height } as DOMRect;
    };
    Object.defineProperty(el, 'offsetWidth', { get: () => size.width });
    Object.defineProperty(el, 'offsetHeight', { get: () => size.height });
    return { el, size };
  }

  it('should keep the corner under the pointer when centered', () => {
    const { el, size } = centered(1000, 400, 100);
    const start = resizeStart(el, { clientX: 700, clientY: 100 } as PointerEvent);
    resizeToPointer(el, start, { clientX: 800, clientY: 150 } as PointerEvent,
      w => size.width = w,
      h => size.height = h);
    expect(el.getBoundingClientRect().right).toBeCloseTo(800, 0);
    expect(el.getBoundingClientRect().bottom).toBeCloseTo(150, 0);
    expect(size.width).toBeCloseTo(600, 0);
  });

  it('should fill the container when the pointer reaches the edge', () => {
    const { el, size } = centered(1000, 400, 100);
    const start = resizeStart(el, { clientX: 700, clientY: 100 } as PointerEvent);
    resizeToPointer(el, start, { clientX: 1000, clientY: 100 } as PointerEvent, w => size.width = w);
    expect(size.width).toBeCloseTo(1000, 0);
  });

  it('should resize 1:1 when not centered', () => {
    const el = document.createElement('div');
    const size = { width: 400 };
    el.getBoundingClientRect = () => ({ left: 0, right: size.width, top: 0, bottom: 100 } as DOMRect);
    Object.defineProperty(el, 'offsetWidth', { get: () => size.width });
    Object.defineProperty(el, 'offsetHeight', { value: 100 });
    const start = resizeStart(el, { clientX: 400, clientY: 100 } as PointerEvent);
    resizeToPointer(el, start, { clientX: 450, clientY: 100 } as PointerEvent, w => size.width = w);
    expect(size.width).toBe(450);
  });
});
