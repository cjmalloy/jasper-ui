import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-range',
  host: { 'class': 'field' },
  template: `
    <input class="grow"
           type="range"
           [min]="props.min"
           [max]="props.max"
           [step]="props.step"
           (blur)="blur($any($event.target))"
           [formControl]="formControl"
           [formlyAttributes]="field"
           [class.is-invalid]="showError">
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldRange extends FieldType<FieldTypeConfig> {

  private showedError = false;

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

  blur(input: HTMLInputElement) {
    if (this.showError && !this.showedError) {
      this.showedError = true;
      this.validate(input);
    } else {
      this.showedError = false;
    }
  }
}
