import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

@Component({
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
  host: {
    '[title]': 'title',
  },
  imports: [CdkDragHandle],
})
export class FormlyWrapperFormField extends FieldWrapper<FormlyFieldConfig> {
  get title() {
    return this.props.title || '';
  }
}
