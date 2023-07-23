import { Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  selector: 'formly-wrapper-form-field',
  template: `
    <label [attr.for]="id" class="form-label" [class.required]="props.required">
      {{ props.label || '' }}
    </label>
    <ng-template #fieldComponent></ng-template>
    <ng-container *ngIf="showError">
      <span><!-- Errors --></span>
      <formly-error [field]="field"></formly-error>
    </ng-container>
  `,
})
export class FormlyWrapperFormField extends FieldWrapper<FormlyFieldConfig> { }
