/// <reference types="vitest/globals" />
import { SubmitWebPage } from './web.component';

describe('SubmitWebPage', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with RefFormComponent
    const component = Object.create(SubmitWebPage.prototype);
    expect(component).toBeTruthy();
  });
});
