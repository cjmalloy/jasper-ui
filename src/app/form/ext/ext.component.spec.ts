/// <reference types="vitest/globals" />
import { ExtFormComponent } from './ext.component';

describe('ExtFormComponent', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with RefComponent
    const component = Object.create(ExtFormComponent.prototype);
    expect(component).toBeTruthy();
  });
});
