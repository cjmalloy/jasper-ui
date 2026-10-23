/// <reference types="vitest/globals" />
import { resizeStart, resizeToPointer, trackTextareaResize } from './resize';

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

describe('trackTextareaResize', () => {
  function pointer(type: string, target: EventTarget, pointerId: number, clientX: number, clientY: number, pointerType = 'mouse') {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    target.dispatchEvent(event);
  }

  it('should ignore other pointers during a resize', () => {
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    const width = () => parseFloat(el.style.width) || 400;
    const height = () => parseFloat(el.style.height) || 100;
    el.getBoundingClientRect = () => ({ left: 0, top: 0, right: width(), bottom: height(), width: width(), height: height() } as DOMRect);
    Object.defineProperty(el, 'offsetWidth', { get: width });
    Object.defineProperty(el, 'offsetHeight', { get: height });
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({ resize: 'both', width: '400px', height: '100px' } as CSSStyleDeclaration);
    const teardown = trackTextareaResize();
    try {
      pointer('pointerdown', el, 1, 395, 95);
      pointer('pointerdown', el, 2, 390, 90, 'pen');
      pointer('pointermove', document, 2, 600, 300, 'touch');
      expect(width()).toBe(400);
      expect(height()).toBe(100);
      pointer('pointerup', document, 2, 600, 300, 'touch');
      pointer('pointermove', document, 1, 445, 115);
      expect(width()).toBe(450);
      expect(height()).toBe(120);
      pointer('pointerup', document, 1, 445, 115);
      pointer('pointermove', document, 1, 500, 200);
      expect(width()).toBe(450);
      expect(height()).toBe(120);
    } finally {
      teardown();
      spy.mockRestore();
      el.remove();
    }
  });
});
