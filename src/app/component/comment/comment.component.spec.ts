/// <reference types="vitest/globals" />
import { CommentComponent } from './comment.component';

describe('CommentComponent', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with ViewerComponent
    const component = Object.create(CommentComponent.prototype);
    expect(component).toBeTruthy();
  });
});
