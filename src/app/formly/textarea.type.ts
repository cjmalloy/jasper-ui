import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig, FormlyFieldProps } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

interface TextAreaProps extends FormlyFieldProps {
  cols?: number;
  rows?: number;
}

@Component({
  standalone: false,
  selector: 'formly-field-textarea',
  template: `
    <textarea (blur)="validate($any($event.target))"
              [formControl]="formControl"
              [cols]="props.cols"
              [rows]="props.rows"
              [class.is-invalid]="showError"
              [formlyAttributes]="field"></textarea>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldTextArea extends FieldType<FieldTypeConfig<TextAreaProps>> {
  override defaultOptions = {
    props: {
      cols: 1,
      rows: 1,
    },
  };

  constructor(
    private config: FormlyConfig,
  ) {
    super();
  }

  validate(input: HTMLTextAreaElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }
}
