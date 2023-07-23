import { OverlayModule } from '@angular/cdk/overlay';
import { NgModule } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { FormlyModule } from '@ngx-formly/core';
import { FormlySelectModule } from '@ngx-formly/core/select';
import {
  QUALIFIED_TAG_REGEX,
  QUALIFIED_USER_REGEX,
  QUERY_REGEX,
  SELECTOR_REGEX,
  TAG_REGEX,
  URI_REGEX,
  USER_REGEX
} from '../util/format';
import { AudioUploadComponent } from './audio-upload/audio-upload.component';
import { FormlyFieldCheckbox } from './checkbox.type';
import { FormlyError } from './errors';
import { FormlyWrapperFormField } from './form-field.wrapper';
import { ImageUploadComponent } from './image-upload/image-upload.component';
import { FormlyFieldInput } from './input.type';
import { ListTypeComponent } from './list.type';
import { FormlyFieldMultiCheckbox } from './multicheckbox.type';
import { QrScannerComponent } from './qr-scanner/qr-scanner.component';
import { FormlyFieldRadio } from './radio.type';
import { FormlyFieldSelect } from './select.type';
import { FormlyFieldTextArea } from './textarea.type';
import { VideoUploadComponent } from './video-upload/video-upload.component';

@NgModule({
  declarations: [
    FormlyWrapperFormField,
    FormlyError,
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
    ListTypeComponent,
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
        name: 'list',
        component: ListTypeComponent,
      }, {
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
        name: 'color',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'color',
            label: $localize`Color: `,
          },
        },
      }, {
        name: 'url',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'url',
            label: $localize`URL:`,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || URI_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in errors.ts',
            }
          },
        },
      }, {
        name: 'urls',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`URLs: `,
            addText: $localize`+ Add URL`,
          },
          fieldArray: {
            type: 'url',
            props: {
              label: $localize`🔗️`,
            }
          },
        },
      }, {
        name: 'email',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'email',
            label: $localize`Email:`,
          },
        },
      }, {
        name: 'tel',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'tel',
            label: $localize`Telephone:`,
          },
        },
      }, {
        name: 'date',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'date',
            label: $localize`Date:`,
          },
        },
      }, {
        name: 'time',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'time',
            label: $localize`Time:`,
          },
        },
      }, {
        name: 'datetime',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'datetime-local',
          },
        },
      }, {
        name: 'week',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'week',
            label: $localize`Week:`,
          },
        },
      }, {
        name: 'month',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'month',
            label: $localize`Month:`,
          },
        },
      }, {
        name: 'image',
        extends: 'url',
        defaultOptions: {
          props: {
            label: $localize`Image:`,
          },
        },
      }, {
        name: 'video',
        extends: 'url',
        defaultOptions: {
          props: {
            label: $localize`Video:`,
          },
        },
      }, {
        name: 'audio',
        extends: 'url',
        defaultOptions: {
          props: {
            label: $localize`Audio:`,
          },
        },
      }, {
        name: 'qr',
        extends: 'url',
      }, {
        name: 'tag',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'email',
            label: $localize`Tag:`,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || TAG_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in errors.ts',
            }
          },
        },
      }, {
        name: 'tags',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Tags: `,
            addText: $localize`+ Add tag`,
          },
          fieldArray: {
            type: 'tag',
            props: {
              label: $localize`🏷️`,
            }
          },
        },
      }, {
        name: 'qtag',
        extends: 'tag',
        defaultOptions: {
          props: {
            label: $localize`Tag: `,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || QUALIFIED_TAG_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in errors.ts',
            }
          },
        },
      }, {
        name: 'qtags',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Tags: `,
            addText: $localize`+ Add tag`,
          },
          fieldArray: {
            type: 'qtag',
            props: {
              label: $localize`🏷️`,
            }
          },
        },
      }, {
        name: 'user',
        extends: 'tag',
        defaultOptions: {
          props: {
            label: $localize`User: `,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || USER_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in errors.ts',
            }
          },
        },
      }, {
        name: 'users',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Users: `,
            addText: $localize`+ Add user`,
          },
          fieldArray: {
            type: 'user',
            props: {
              label: $localize`🏷️`,
            }
          },
        },
      }, {
        name: 'quser',
        extends: 'user',
        defaultOptions: {
          props: {
            label: $localize`User: `,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || QUALIFIED_USER_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in errors.ts',
            }
          },
        },
      }, {
        name: 'qusers',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Users: `,
            addText: $localize`+ Add user`,
          },
          fieldArray: {
            type: 'quser',
            props: {
              label: $localize`🏷️`,
            }
          },
        },
      }, {
        name: 'selector',
        extends: 'tag',
        defaultOptions: {
          props: {
            label: $localize`Tag: `,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || SELECTOR_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in errors.ts',
            }
          },
        },
      }, {
        name: 'selectors',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Tags: `,
            addText: $localize`+ Add tag`,
          },
          fieldArray: {
            type: 'selector',
            props: {
              label: $localize`🔖️`,
            }
          },
        },
      }, {
        name: 'query',
        extends: 'tag',
        defaultOptions: {
          props: {
            label: $localize`Query: `,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || QUERY_REGEX.test(c.value),
              message: 'Error message contains HTML, so there is a special override in errors.ts',
            }
          },
        },
      }, {
        name: 'queries',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Query: `,
            addText: $localize`+ Add query`,
          },
          fieldArray: {
            type: 'query',
            props: {
              label: $localize`🔖️`,
            }
          },
        },
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
