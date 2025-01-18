import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

@Component({
  standalone: false,
  selector: 'formly-field-checkbox',
  template: `
    <input type="checkbox" [formControl]="formControl" [formlyAttributes]="field">
  `,
  host: {'class': 'block-form'},
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldCheckbox extends FieldType<FieldTypeConfig> { }
