import { ElementRef } from '@angular/core';
import { TemplateUiDirective } from './template-ui.directive';

describe('TemplateUiDirective', () => {
  it('should create an instance', () => {
    const directive = new TemplateUiDirective({} as ElementRef);
    expect(directive).toBeTruthy();
  });
});
