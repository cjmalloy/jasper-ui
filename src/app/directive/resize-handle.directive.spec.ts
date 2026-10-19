/// <reference types="vitest/globals" />
import { ResizeHandleDirective } from './resize-handle.directive';

describe('ResizeHandleDirective', () => {
  it('should create an instance', () => {
    const directive = new ResizeHandleDirective({} as any, {} as any, {} as any, {} as any);
    expect(directive).toBeTruthy();
  });
});

describe('ResizeHandleDirective hit test', () => {
  it('should start dragging from the corner of an element inside a scrolled container', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'offsetTop', { value: 3000 });
    Object.defineProperty(el, 'offsetWidth', { value: 400 });
    Object.defineProperty(el, 'offsetHeight', { value: 300 });
    el.getBoundingClientRect = () => ({ left: 100, top: 400, right: 500, bottom: 700, width: 400, height: 300 } as DOMRect);
    const directive = new ResizeHandleDirective({ mobile: false } as any, { nativeElement: el } as any, {} as any, {} as any);
    const event = { button: 0, clientX: 495, clientY: 695, preventDefault: vi.fn(), stopPropagation: vi.fn(), stopImmediatePropagation: vi.fn() } as any;
    directive.onPointerDown(event);
    expect(directive.dragging).toBe(true);
    expect(directive.width).toBe(400);
    expect(directive.height).toBe(300);
  });

  it('should ignore pointer down away from the corner', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: 100, top: 400, right: 500, bottom: 700, width: 400, height: 300 } as DOMRect);
    const directive = new ResizeHandleDirective({ mobile: false } as any, { nativeElement: el } as any, {} as any, {} as any);
    directive.onPointerDown({ button: 0, clientX: 300, clientY: 500 } as any);
    expect(directive.dragging).toBe(false);
  });
});
