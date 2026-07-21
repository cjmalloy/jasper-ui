import { TestBed } from '@angular/core/testing';
import { EventBus } from '../store/bus';
import { ImageDirective } from './image.directive';

describe('ImageDirective', () => {
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new ImageDirective(
      {} as any,
      { eventBus: new EventBus() } as any,
      { nativeElement: { style: {}}} as any,
      {} as any,
    ));
    expect(directive).toBeTruthy();
  });
});
