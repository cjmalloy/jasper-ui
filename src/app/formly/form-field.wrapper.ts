import { Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  selector: 'formly-wrapper-form-field',
  template: `
    <label [attr.for]="id" class="form-label" [class.required]="props.required">
      {{ props.label || '' }}
    </label>
    <ng-template #fieldComponent></ng-template>
    <span><!-- Errors --></span>
    <div>
      <div *ngIf="showError" class="error">
        <formly-validation-message [field]="field"></formly-validation-message>
      </div>
    </div>
  `,
})
export class FormlyWrapperFormField extends FieldWrapper<FormlyFieldConfig> {}
