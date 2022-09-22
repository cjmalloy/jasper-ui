import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';

interface TextAreaProps extends FormlyFieldProps {
  cols?: number;
  rows?: number;
}

@Component({
  selector: 'formly-field-textarea',
  template: `
    <textarea [formControl]="formControl"
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
}
