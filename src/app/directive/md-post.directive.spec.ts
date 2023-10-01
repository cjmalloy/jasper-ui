import { MdPostDirective } from './md-post.directive';

describe('MdPostDirective', () => {
  it('should create an instance', () => {
    const directive = new MdPostDirective(
      {} as any,
      {} as any,
    );
    expect(directive).toBeTruthy();
  });
});
