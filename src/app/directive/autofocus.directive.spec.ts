/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AutofocusDirective } from './autofocus.directive';

@Component({
  template: '<input [appAutofocus]="true">',
  imports: [AutofocusDirective],
})
class TestComponent {}

describe('AutofocusDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(AutofocusDirective);
    expect(directive).toBeTruthy();
  });
});
