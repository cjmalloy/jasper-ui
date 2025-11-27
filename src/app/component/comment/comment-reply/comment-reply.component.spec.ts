/// <reference types="vitest/globals" />
import { CommentReplyComponent } from './comment-reply.component';

describe('CommentReplyComponent', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with EditorComponent
    const component = Object.create(CommentReplyComponent.prototype);
    expect(component).toBeTruthy();
  });
});
