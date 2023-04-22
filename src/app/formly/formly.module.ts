import { OverlayModule } from '@angular/cdk/overlay';
import { NgModule } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { FormlyModule } from '@ngx-formly/core';
import { FormlySelectModule } from '@ngx-formly/core/select';
import { URI_REGEX } from '../util/format';
import { AudioUploadComponent } from './audio-upload/audio-upload.component';
import { FormlyFieldCheckbox } from './checkbox.type';
import { FormlyWrapperFormField } from './form-field.wrapper';
import { ImageUploadComponent } from './image-upload/image-upload.component';
import { FormlyFieldInput } from './input.type';
import { FormlyFieldMultiCheckbox } from './multicheckbox.type';
import { QrScannerComponent } from './qr-scanner/qr-scanner.component';
import { FormlyFieldRadio } from './radio.type';
import { FormlyFieldSelect } from './select.type';
import { FormlyFieldTextArea } from './textarea.type';
import { VideoUploadComponent } from './video-upload/video-upload.component';

@NgModule({
  declarations: [
    FormlyWrapperFormField,
    FormlyFieldInput,
    FormlyFieldTextArea,
    FormlyFieldCheckbox,
    FormlyFieldMultiCheckbox,
    FormlyFieldRadio,
    FormlyFieldSelect,
    QrScannerComponent,
    ImageUploadComponent,
    VideoUploadComponent,
    AudioUploadComponent,
  ],
  exports: [
    QrScannerComponent,
    ImageUploadComponent,
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    OverlayModule,
    FormlySelectModule,
    FormlyModule.forRoot({
      validationMessages: [
        { name: 'required', message: 'This field is required' },
      ],
      wrappers: [{
        name: 'form-field',
        component: FormlyWrapperFormField,
      }],
      types: [{
        name: 'input',
        component: FormlyFieldInput,
        wrappers: ['form-field'],
      }, {
        name: 'string',
        extends: 'input',
      }, {
        name: 'number',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'number',
          },
        },
      }, {
        name: 'integer',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'number',
          },
        },
      }, {
        name: 'url',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'url',
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || URI_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in form-field.wrapper.ts',
            }
          },
        },
      }, {
        name: 'image',
        extends: 'url',
      }, {
        name: 'video',
        extends: 'url',
      }, {
        name: 'audio',
        extends: 'url',
      }, {
        name: 'qr',
        extends: 'url',
      }, {
        name: 'textarea',
        component: FormlyFieldTextArea,
        wrappers: ['form-field'],
      }, {
        name: 'checkbox',
        component: FormlyFieldCheckbox,
        wrappers: ['form-field'],
      }, {
        name: 'multicheckbox',
        component: FormlyFieldMultiCheckbox,
        wrappers: ['form-field'],
      }, {
        name: 'boolean',
        extends: 'checkbox',
      }, {
        name: 'radio',
        component: FormlyFieldRadio,
        wrappers: ['form-field'],
      }, {
        name: 'select',
        component: FormlyFieldSelect,
        wrappers: ['form-field'],
      }, {
        name: 'enum',
        extends: 'select',
      }],
    }),
  ],
})
export class JasperFormlyModule { }
