import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
    selector: 'formly-field-checkbox',
    template: `
    <input type="checkbox" [formControl]="formControl" [formlyAttributes]="field">
  `,
    host: { 'class': 'block-form' },
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, FormlyModule],
})
export class FormlyFieldCheckbox extends FieldType<FieldTypeConfig> { }
