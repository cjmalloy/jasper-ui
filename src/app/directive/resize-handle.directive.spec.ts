/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResizeHandleDirective } from './resize-handle.directive';

@Component({
  template: '<div [appResizeHandle]="true"></div>',
  imports: [ResizeHandleDirective],
})
class TestComponent {}

describe('ResizeHandleDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(ResizeHandleDirective);
    expect(directive).toBeTruthy();
  });
});
