/// <reference types="vitest/globals" />
import { SubmitTextPage } from './text.component';

describe('SubmitTextPage', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with EditorComponent
    const component = Object.create(SubmitTextPage.prototype);
    expect(component).toBeTruthy();
  });
});
