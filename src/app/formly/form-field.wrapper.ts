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
      <div class="error">
        <span *ngIf="field.type === 'url' && field.formControl?.errors?.['pattern'] else defaultMessage" i18n>
          Must be a valid URI according to <a target="_blank" href="https://datatracker.ietf.org/doc/html/rfc3986">RFC 3986</a>.
        </span>
        <ng-template #defaultMessage>
          <formly-validation-message [field]="field"></formly-validation-message>
        </ng-template>
      </div>
    </ng-container>
  `,
})
export class FormlyWrapperFormField extends FieldWrapper<FormlyFieldConfig> { }
