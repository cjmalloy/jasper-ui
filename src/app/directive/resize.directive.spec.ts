/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResizeDirective } from './resize.directive';

describe('ResizeDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: { nativeElement: { style: {} } } },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new ResizeDirective());
    expect(directive).toBeTruthy();
  });

  function create() {
    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: { nativeElement: { style: {}, offsetWidth: 100, offsetHeight: 100 } } },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new ResizeDirective());
    const clicks: MouseEvent[] = [];
    directive.resizeClick.subscribe(e => clicks.push(e));
    return { directive, clicks };
  }

  function mouse(type: string, x = 0, y = 0) {
    return new MouseEvent(type, { clientX: x, clientY: y, cancelable: true });
  }

  it('emits clicks that did not resize', () => {
    const { directive, clicks } = create();
    directive.onMousedown(mouse('mousedown'));
    directive.onCancel(mouse('mouseup'));
    directive.onClick(mouse('click'));
    expect(clicks.length).toBe(1);
  });

  it('swallows the click that ends a resize drag', () => {
    const { directive, clicks } = create();
    directive.onMousedown(mouse('mousedown'));
    directive.onMousemove(mouse('mousemove', 20, 20));
    directive.onCancel(mouse('mouseup', 20, 20));
    const click = mouse('click', 20, 20);
    directive.onClick(click);
    expect(click.defaultPrevented).toBe(true);
    expect(clicks.length).toBe(0);
    directive.onMousedown(mouse('mousedown'));
    directive.onCancel(mouse('mouseup'));
    directive.onClick(mouse('click'));
    expect(clicks.length).toBe(1);
  });
});
