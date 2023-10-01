import { ElementRef } from '@angular/core';
import { Store } from '../store/store';
import { TemplateUiDirective } from './template-ui.directive';

describe('TemplateUiDirective', () => {
  it('should create an instance', () => {
    const directive = new TemplateUiDirective({} as Store, {} as ElementRef);
    expect(directive).toBeTruthy();
  });
});
