import { ElementRef } from '@angular/core';
import { PluginUiDirective } from './plugin-ui.directive';

describe('PluginUiDirective', () => {
  it('should create an instance', () => {
    const directive = new PluginUiDirective({} as ElementRef);
    expect(directive).toBeTruthy();
  });
});
