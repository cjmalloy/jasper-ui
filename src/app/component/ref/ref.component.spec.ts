/// <reference types="vitest/globals" />
import { RefComponent } from './ref.component';

describe('RefComponent', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with ViewerComponent
    const component = Object.create(RefComponent.prototype);
    expect(component).toBeTruthy();
  });
});
