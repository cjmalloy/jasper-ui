import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-input',
  template: `
    <div class="form-array">
      @if (type !== 'number') {
        <input class="grow"
               (blur)="validate($any($event.target))"
               [type]="type"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
      } @else {
        <input type="number"
               class="grow"
               (blur)="validate($any($event.target))"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
      }
      <app-qr-scanner *ngIf="field.type === 'qr'" (data)="$event && field.formControl!.setValue($event)"></app-qr-scanner>
      <app-audio-upload *ngIf="field.type === 'audio'" (data)="$event && field.formControl!.setValue($event)"></app-audio-upload>
      <app-video-upload *ngIf="field.type === 'video'" (data)="$event && field.formControl!.setValue($event)"></app-video-upload>
      <app-image-upload *ngIf="field.type === 'image'" (data)="$event && field.formControl!.setValue($event)"></app-image-upload>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldInput extends FieldType<FieldTypeConfig> {

  constructor(
    private config: FormlyConfig,
  ) {
    super();
  }

  /**
   * Overrides the <input> type. Not related to the formly field type.
   *
   * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#input_types
   */
  get type() {
    return this.props.type || 'text';
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }
}
