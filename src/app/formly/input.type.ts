import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { AdminService } from '../service/admin.service';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-input',
  host: {'class': 'field'},
  template: `
    <div class="form-array">
      @if (type !== 'number') {
        <input class="grow"
               (blur)="blur($any($event.target))"
               [type]="type"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
      } @else {
        <input type="number"
               class="grow"
               (blur)="blur($any($event.target))"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
      }
      @if (props.clear) { <button type="button" (click)="field.formControl!.setValue(null)" i18n-title title="Clear" i18n>🆑️</button> }
      @if (field.type   ===    'qr') { <app-qr-scanner   (data)="$event && field.formControl!.setValue($event)"></app-qr-scanner> }
      @if (files) {
        @if (field.type ===   'pdf') { <app-pdf-upload   (data)="$event && field.formControl!.setValue($event)"></app-pdf-upload> }
        @if (field.type === 'audio') { <app-audio-upload (data)="$event && field.formControl!.setValue($event)"></app-audio-upload> }
        @if (field.type === 'video') { <app-video-upload (data)="$event && field.formControl!.setValue($event)"></app-video-upload> }
        @if (field.type === 'image') { <app-image-upload (data)="$event && field.formControl!.setValue($event)"></app-image-upload> }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldInput extends FieldType<FieldTypeConfig> {

  files = !!this.admin.getPlugin('plugin/file');

  private showedError = false;

  constructor(
    private config: FormlyConfig,
    private admin: AdminService,
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

  blur(input: HTMLInputElement) {
    if (this.showError && !this.showedError) {
      this.showedError = true;
      this.validate(input);
    } else {
      this.showedError = false;
    }
  }
}
