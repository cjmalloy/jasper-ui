import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes } from '@ngx-formly/core';

@Component({
  selector: 'formly-field-checkbox',
  template: `
    <input type="checkbox" [formControl]="formControl" [formlyAttributes]="field">
  `,
  host: { 'class': 'block-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormlyAttributes],
})
export class FormlyFieldCheckbox extends FieldType<FieldTypeConfig> { }
