/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LimitWidthDirective } from './limit-width.directive';

@Component({
  template: '<div [appLimitWidth]="null"></div>',
  imports: [LimitWidthDirective],
})
class TestComponent {}

describe('LimitWidthDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(LimitWidthDirective);
    expect(directive).toBeTruthy();
  });
});
