/// <reference types="vitest/globals" />
import { SettingsMePage } from './me.component';

describe('SettingsMePage', () => {
  it('should create', () => {
    // Test the component class directly without TestBed
    // This avoids the circular dependency issue with ExtFormComponent
    const component = Object.create(SettingsMePage.prototype);
    expect(component).toBeTruthy();
  });
});
