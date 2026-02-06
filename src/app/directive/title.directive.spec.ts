/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TitleDirective } from './title.directive';

@Component({
  template: '<div [appTitle]="\'test\'"></div>',
  imports: [TitleDirective],
})
class TestComponent {}

describe('TitleDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(TitleDirective);
    expect(directive).toBeTruthy();
  });
});
