import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig, FormlyFieldProps } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-location',
  host: { 'class': 'field' },
  template: `
    <div class="form-array skip-margin">
      <!-- TODO -->
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldLocation extends FieldType<FieldTypeConfig> {

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
