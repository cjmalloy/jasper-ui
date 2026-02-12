/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResizeDirective } from './resize.directive';

@Component({
  template: '<div [appResize]="true"></div>',
  imports: [ResizeDirective],
})
class TestComponent {}

describe('ResizeDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(ResizeDirective);
    expect(directive).toBeTruthy();
  });
});
