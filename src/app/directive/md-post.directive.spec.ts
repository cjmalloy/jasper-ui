/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { MdPostDirective } from './md-post.directive';

describe('MdPostDirective', () => {
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new MdPostDirective(
      {} as any,
      {} as any,
    ));
    expect(directive).toBeTruthy();
  });
});
