import { Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  selector: 'formly-wrapper-form-field',
  host: {
    '[title]': 'title',
  },
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

    @if (props.footer) {
      <div class="nested-footer-left">
        <!-- Footer -->
      </div>
      <div class="nested-footer-right">
        <!-- Footer -->
      </div>
    }
  `,
})
export class FormlyWrapperFormGroup extends FieldWrapper<FormlyFieldConfig> {
  get title() {
    return this.props.title || '';
  }
}
