import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyConfig, FormlyFieldProps, FormlyModule } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

interface TextAreaProps extends FormlyFieldProps {
  cols?: number;
  rows?: number;
}

@Component({
    selector: 'formly-field-textarea',
    host: { 'class': 'field' },
    template: `
    <textarea (blur)="validate($any($event.target))"
              [formControl]="formControl"
              [cols]="props.cols"
              [rows]="props.rows"
              [class.is-invalid]="showError"
              [formlyAttributes]="field"></textarea>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, FormlyModule],
})
export class FormlyFieldTextArea extends FieldType<FieldTypeConfig<TextAreaProps>> {
  override defaultOptions = {
    props: {
      cols: 1,
      rows: 1,
    },
  };

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
