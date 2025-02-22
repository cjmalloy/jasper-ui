import { Component, HostBinding } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  standalone: false,
  selector: 'formly-wrapper-form-field',
  template: `
    <div>
      <!-- Label -->
    </div>
    <label class="nested-title">
      {{ props.label || '' }}
    </label>

    <div class="nested-form">
      <ng-template #fieldComponent></ng-template>
    </div>
  `,
})
export class FormlyWrapperFormGroup extends FieldWrapper<FormlyFieldConfig> {
  @HostBinding('title')
  get title() {
    return this.props.title || '';
  }
}
