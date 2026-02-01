import { inject, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ImageDirective } from './image.directive';

describe('ImageDirective', () => {
  it('should create an instance', () => {
    const directive = new ImageDirective(
      TestBed.inject(Injector),
      {} as any,
      {} as any,
      { nativeElement: { style: {}}} as any,
      {} as any,
    );
    expect(directive).toBeTruthy();
  });
});
