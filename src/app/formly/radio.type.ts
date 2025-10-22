import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { NgFor, AsyncPipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormlySelectModule } from '@ngx-formly/core/select';

@Component({
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
    imports: [
        NgFor,
        ReactiveFormsModule,
        FormlyModule,
        AsyncPipe,
        FormlySelectModule,
    ],
})
export class FormlyFieldRadio extends FieldType<FieldTypeConfig> { }
