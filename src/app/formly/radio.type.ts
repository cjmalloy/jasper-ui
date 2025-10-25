import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes } from '@ngx-formly/core';
import { FormlySelectModule } from '@ngx-formly/core/select';

@Component({
  selector: 'formly-field-radio',
  template: `
    @for (option of props.options | formlySelectOptions: field | async; track option.value; let i = $index) {
      <input type="radio"
             [id]="id + '_' + i"
             [class.is-invalid]="showError"
             [attr.value]="option.value"
             [value]="option.value"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [attr.disabled]="option.disabled || formControl.disabled ? true : null">
      <label [for]="id + '_' + i">{{ option.label }}</label>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    FormlySelectModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldRadio extends FieldType<FieldTypeConfig> { }
