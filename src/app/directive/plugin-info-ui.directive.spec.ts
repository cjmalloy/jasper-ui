import { ElementRef } from '@angular/core';
import { PluginInfoUiDirective } from './plugin-info-ui.directive';

describe('PluginInfoUiDirective', () => {
  it('should create an instance', () => {
    const directive = new PluginInfoUiDirective({} as ElementRef);
    expect(directive).toBeTruthy();
  });
});
