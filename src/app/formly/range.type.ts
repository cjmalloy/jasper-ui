import { ChangeDetectionStrategy, Component, HostBinding } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-range',
  template: `
    <input class="grow"
           type="range"
           [min]="props.min"
           [max]="props.max"
           [step]="props.step"
           (blur)="validate($any($event.target))"
           [formControl]="formControl"
           [formlyAttributes]="field"
           [class.is-invalid]="showError">
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldRange extends FieldType<FieldTypeConfig> {

  @HostBinding('class.field')
  css = true;

  constructor(
    private config: FormlyConfig,
  ) {
    super();
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }
}
