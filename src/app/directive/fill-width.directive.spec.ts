/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FillWidthDirective } from './fill-width.directive';

@Component({
  template: '<textarea [appFillWidth]="undefined"></textarea>',
  imports: [FillWidthDirective],
})
class TestComponent {}

describe('FillWidthDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(FillWidthDirective);
    expect(directive).toBeTruthy();
  });
});
