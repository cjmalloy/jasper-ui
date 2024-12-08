import { Component, HostBinding } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  standalone: false,
  selector: 'formly-wrapper-form-field',
  template: `
    <label cdkDragHandle [attr.for]="id" class="form-label" [class.required]="props.required">
      {{ props.label || '' }}
    </label>
    <ng-template #fieldComponent></ng-template>
    @if (props.hint) {
      <span><!-- Hint --></span>
      <div class="no-margin">
        <span class="hints">{{ props.hint }}</span>
      </div>
    }
  `,
})
export class FormlyWrapperFormField extends FieldWrapper<FormlyFieldConfig> {
  @HostBinding('title')
  get title() {
    return this.props.title || '';
  }
}
