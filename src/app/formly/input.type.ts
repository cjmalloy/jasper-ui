import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
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
      @if (props.clear) { <button type="button" (click)="field.formControl!.setValue(null)" i18n-title title="Clear" i18n>🆑️</button> }
      @if (field.type ===    'qr') { <app-qr-scanner   (data)="$event && field.formControl!.setValue($event)"></app-qr-scanner> }
      @if (field.type === 'audio') { <app-audio-upload (data)="$event && field.formControl!.setValue($event)"></app-audio-upload> }
      @if (field.type === 'video') { <app-video-upload (data)="$event && field.formControl!.setValue($event)"></app-video-upload> }
      @if (field.type === 'image') { <app-image-upload (data)="$event && field.formControl!.setValue($event)"></app-image-upload> }
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
