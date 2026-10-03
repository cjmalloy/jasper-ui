/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { FillWidthDirective } from './fill-width.directive';

describe('FillWidthDirective', () => {
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new FillWidthDirective({} as any, { nativeElement: document.createElement('textarea') }));
    expect(directive).toBeTruthy();
  });
});
