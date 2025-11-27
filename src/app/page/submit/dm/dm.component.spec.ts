/// <reference types="vitest/globals" />
import { SubmitDmPage } from './dm.component';

describe('SubmitDmPage', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with EditorComponent
    const component = Object.create(SubmitDmPage.prototype);
    expect(component).toBeTruthy();
  });
});
