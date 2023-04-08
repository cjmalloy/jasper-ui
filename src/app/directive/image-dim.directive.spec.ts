import { ImageDimDirective } from './image-dim.directive';

describe('ImageDimDirective', () => {
  it('should create an instance', () => {
    const directive = new ImageDimDirective({} as any, { nativeElement: { style: {}}} as any, {} as any);
    expect(directive).toBeTruthy();
  });
});
