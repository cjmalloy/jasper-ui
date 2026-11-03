import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { isString } from 'lodash-es';
import { Observable } from 'rxjs';
import { AdminService } from '../service/admin.service';
import { Saving } from '../store/submit';
import { AudioUploadComponent } from './audio-upload/audio-upload.component';
import { getErrorMessage } from './errors';
import { ImageUploadComponent } from './image-upload/image-upload.component';
import { PdfUploadComponent } from './pdf-upload/pdf-upload.component';
import { QrScannerComponent } from './qr-scanner/qr-scanner.component';
import { VideoUploadComponent } from './video-upload/video-upload.component';

@Component({
  selector: 'formly-field-input',
  host: { 'class': 'field' },
  template: `
    <div class="form-array">
      @if (uploading()) {
        <progress class="grow" max="100" [value]="progress()"></progress>
      } @else if (type !== 'number') {
        <input class="grow"
               (blur)="blur($any($event.target))"
               (focus)="focus()"
               [type]="type"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [attr.list]="props.suggestions ? id + '-suggestions' : null"
               [class.is-invalid]="showError"
               [class.cleared]="props.clear && !field.formControl.value">
        @if (props.suggestions) {
          <datalist [id]="id + '-suggestions'">
            @for (s of suggestions(); track s) {
              <option [value]="s"></option>
            }
          </datalist>
        }
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
      @if (files()) {
        @if (field.type ===   'pdf') { <app-pdf-upload   (data)="onUpload($event)"></app-pdf-upload> }
        @if (field.type === 'audio') { <app-audio-upload (data)="onUpload($event)"></app-audio-upload> }
        @if (field.type === 'video') { <app-video-upload (data)="onUpload($event)"></app-video-upload> }
        @if (field.type === 'image') { <app-image-upload (data)="onUpload($event)"></app-image-upload> }
      }
    </div>
  `,
  imports: [
    ReactiveFormsModule,
    QrScannerComponent,
    PdfUploadComponent,
    AudioUploadComponent,
    VideoUploadComponent,
    ImageUploadComponent,
    FormlyAttributes,
  ],
})
export class FormlyFieldInput extends FieldType<FieldTypeConfig> {
  private config = inject(FormlyConfig);
  private admin = inject(AdminService);


  readonly progress = signal<number | undefined>(undefined);
  readonly uploading = signal(false);
  readonly files = computed(() => !!this.admin.getPlugin('plugin/file'));

  private showedError = false;

  /**
   * Overrides the <input> type. Not related to the formly field type.
   *
   * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#input_types
   */
  get type() {
    return this.props.type || 'text';
  }

  private readonly suggested = rxResource({
    params: () => this.props.suggestions,
    stream: ({ params }) => params(this.admin) as Observable<string[]>,
  });

  /**
   * Values used by the other items of the parent list, read on focus.
   */
  private readonly used = signal<unknown[]>([]);

  /**
   * Suggested values, skipping values already in the parent list.
   */
  readonly suggestions = computed(() => {
    const used = this.used();
    return (this.suggested.hasValue() ? this.suggested.value() : []).filter(s => !used.includes(s));
  });

  focus() {
    if (!this.props.suggestions) return;
    const list = this.field.parent?.model;
    this.used.set(Array.isArray(list) ? list.filter((v, i) => String(i) !== String(this.field.key) && v) : []);
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

  onUpload(event?: Saving | string) {
    if (!event) {
      this.uploading.set(false);
    } else if (isString(event)) {
      // TODO set error
    } else if (event.url) {
      this.uploading.set(false);
      this.field.formControl!.setValue(event.url);
    } else {
      this.uploading.set(true);
      this.progress.set(event.progress || undefined);
    }
  }
}
