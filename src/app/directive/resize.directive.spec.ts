/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { ResizeDirective } from './resize.directive';

describe('ResizeDirective', () => {
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new ResizeDirective({} as any));
    expect(directive).toBeTruthy();
  });
});
