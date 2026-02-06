/// <reference types="vitest/globals" />
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ImageDirective } from './image.directive';

@Component({
  template: '<img appImage>',
  imports: [ImageDirective],
})
class TestComponent {}

describe('ImageDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    const fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    const directive = directiveEl.injector.get(ImageDirective);
    expect(directive).toBeTruthy();
  });
});
