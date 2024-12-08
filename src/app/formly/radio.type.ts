import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

@Component({
  standalone: false,
  selector: 'formly-field-radio',
  template: `
    <ng-container *ngFor="let option of props.options | formlySelectOptions: field | async; let i = index">
      <input type="radio"
             [id]="id + '_' + i"
             [class.is-invalid]="showError"
             [attr.value]="option.value"
             [value]="option.value"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [attr.disabled]="option.disabled || formControl.disabled ? true : null">
      <label [for]="id + '_' + i">{{ option.label }}</label>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldRadio extends FieldType<FieldTypeConfig> { }
