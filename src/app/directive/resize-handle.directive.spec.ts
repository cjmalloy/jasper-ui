/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from '../service/config.service';
import { ResizeHandleDirective } from './resize-handle.directive';

describe('ResizeHandleDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: {} },
        { provide: ElementRef, useValue: { nativeElement: {} } },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new ResizeHandleDirective());
    expect(directive).toBeTruthy();
  });
});

describe('ResizeHandleDirective hit test', () => {
  function create(el: HTMLElement) {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: { mobile: () => false } },
        { provide: ElementRef, useValue: { nativeElement: el } },
      ],
    });
    return TestBed.runInInjectionContext(() => new ResizeHandleDirective());
  }

  it('should start dragging from the corner of an element inside a scrolled container', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'offsetTop', { value: 3000 });
    Object.defineProperty(el, 'offsetWidth', { value: 400 });
    Object.defineProperty(el, 'offsetHeight', { value: 300 });
    el.getBoundingClientRect = () => ({ left: 100, top: 400, right: 500, bottom: 700, width: 400, height: 300 } as DOMRect);
    const directive = create(el);
    const event = { button: 0, clientX: 495, clientY: 695, preventDefault: vi.fn(), stopPropagation: vi.fn(), stopImmediatePropagation: vi.fn() } as any;
    directive.onPointerDown(event);
    expect(directive.dragging()).toBe(true);
    expect(directive.start?.width).toBe(400);
    expect(directive.start?.height).toBe(300);
  });

  it('should ignore pointer down away from the corner', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: 100, top: 400, right: 500, bottom: 700, width: 400, height: 300 } as DOMRect);
    const directive = create(el);
    directive.onPointerDown({ button: 0, clientX: 300, clientY: 500 } as any);
    expect(directive.dragging()).toBe(false);
  });
});
