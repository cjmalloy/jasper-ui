import { TestBed } from '@angular/core/testing';
import { LimitWidthDirective } from './limit-width.directive';

describe('LimitWidthDirective', () => {
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new LimitWidthDirective({} as any, {} as any));
    expect(directive).toBeTruthy();
  });
});
