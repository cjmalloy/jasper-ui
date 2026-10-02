/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { ResizeHandleDirective } from './resize-handle.directive';

describe('ResizeHandleDirective', () => {
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new ResizeHandleDirective({} as any, {} as any));
    expect(directive).toBeTruthy();
  });
});
