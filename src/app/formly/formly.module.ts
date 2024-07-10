import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { NgModule } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { FormlyModule } from '@ngx-formly/core';
import { FormlySelectModule } from '@ngx-formly/core/select';
import * as moment from 'moment';
import {
  ORIGIN_REGEX,
  PLUGIN_REGEX,
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
import { DurationInputAccessor, FormlyFieldDuration } from './duration.type';
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
    FormlyFieldInput,
    FormlyFieldTextArea,
    FormlyFieldCheckbox,
    FormlyFieldMultiCheckbox,
    FormlyFieldRadio,
    FormlyFieldSelect,
    FormlyFieldDuration,
    DurationInputAccessor,
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
    DragDropModule,
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
              message: $localize`Must be a valid URI (see RFC 3986).`,
            }
          },
        },
      }, {
        name: 'urls',
        extends: 'list',
        defaultOptions: {
          props: {
            showLabel: true,
            label: $localize`URLs: `,
            showAdd: true,
            addText: $localize`+ Add another URL`,
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
        name: 'duration',
        component: FormlyFieldDuration,
        wrappers: ['form-field'],
        defaultOptions: {
          props: {
            label: $localize`Duration:`,
            hint: $localize`Use time spans (HH:MM:SS) or ISO 8601 Durations`,
          },
          validators: {
            interval: {
              expression: (c: AbstractControl) =>  moment.duration(c.value).isValid(),
              message: $localize`Scrape Duration must be valid time span (HH:MM:SS) or ISO 8601 Duration.`,
            }
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
              message: $localize`
                Tags must be lower case letters, numbers, periods and forward slashes.
                Must not start with a forward slash or period.
                Must not or contain two forward slashes or periods in a row.
                Protected tags start with a plus sign.
                Private tags start with an underscore.
                (i.e. "science", "my/tag", or "_my/private/tag")`,
            }
          },
        },
      }, {
        name: 'origin',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'email',
            label: $localize`Origin:`,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || ORIGIN_REGEX.test(c.value),
              message: $localize`
                Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
                The default origin is blank.
                Must not start with a period or contain two periods in a row.
                (i.e. "@origin", "@my.origin", or "").`,
            }
          },
        },
      }, {
        name: 'plugin',
        extends: 'input',
        defaultOptions: {
          props: {
            type: 'email',
            label: $localize`Plugin:`,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || PLUGIN_REGEX.test(c.value),
              message: $localize`
                Plugin tags must start with the "plugin/", "+plugin/" or "_plugin/" prefix.
                Tags must be lower case letters, numbers, periods and forward slashes.
                Must not start with a forward slash or period.
                Must not or contain two forward slashes or periods in a row.
                Protected tags start with a plus sign.
                Private tags start with an underscore.
                (i.e. "plugin/thumbnail", "plugin/image" "+plugin/cron", or "_plugin/admin")`,
            }
          },
        },
      }, {
        name: 'tags',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Tags: `,
            addText: $localize`+ Add another tag`,
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
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || QUALIFIED_TAG_REGEX.test(c.value),
              message: $localize`
                Tags must be lower case letters, numbers, periods and forward slashes.
                Must not start with a forward slash or period.
                Must not or contain two forward slashes or periods in a row.
                Tags may be qualified with an origin.
                Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
                Protected tags start with a plus sign.
                Private tags start with an underscore.
                (i.e. "science", "science@origin" "my/tag", or "_my/private/tag")`,
            }
          },
        },
      }, {
        name: 'qtags',
        extends: 'tags',
        defaultOptions: {
          fieldArray: {
            type: 'qtag',
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
              message: $localize`
                User tags must start with the "+user/" or "_user/" prefix.
                Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
                tags start with an underscore.
                (i.e. "+user/alice", "_user/bob", or "+user/department/charlie")`,
            }
          },
        },
      }, {
        name: 'users',
        extends: 'list',
        defaultOptions: {
          props: {
            label: $localize`Users: `,
            addText: $localize`+ Add another user`,
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
              message: $localize`
                User tags must start with the "+user/" or "_user/" prefix.
                Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
                tags start with an underscore.
                Tags may be qualified with an origin.
                Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
                (i.e. "+user/alice", "_user/bob", or "+user/department/charlie")`,
            }
          },
        },
      }, {
        name: 'qusers',
        extends: 'users',
        defaultOptions: {
          fieldArray: {
            type: 'quser',
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
              message: $localize`
                Tags must be lower case letters, numbers, periods and forward slashes.
                Must not start with a forward slash or period.
                Must not or contain two forward slashes or periods in a row.
                Use the local wildcard (*) to match all tags with a local origin.
                Tags may be qualified with an origin, or a wildcard origin (@*).
                Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
                Use an origin without a tag to match all tags at that origin.
                The wildcard origin (@*) by itself will match everything.
                Protected tags start with a plus sign.
                Private tags start with an underscore.
                (i.e. "*", "science", "science@origin" "my/tag@", or "_my/private/tag")`,
            }
          },
        },
      }, {
        name: 'selectors',
        extends: 'tags',
        defaultOptions: {
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
              message: $localize`
                Queries support AND (:), OR (|), NOT (!) and grouping qualified tags (parentheses).
                Tags must be lower case letters, numbers, periods and forward slashes.
                Must not start with a forward slash or period.
                Must not or contain two forward slashes or periods in a row.
                Use the local wildcard (*) to match all tags with a local origin.
                Tags may be qualified with an origin, or a wildcard origin (@*).
                Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
                Use an origin without a tag to match all tags at that origin.
                The wildcard origin (@*) by itself will match everything.
                Protected tags start with a plus sign.
                Private tags start with an underscore.
                (i.e. "science:news", "science@origin science@other" "your/tag my/tag", "!cool", or "news:_my/private/tag")`,
            }
          },
        },
      }, {
        name: 'queries',
        extends: 'selectors',
        defaultOptions: {
          props: {
            label: $localize`Query: `,
            addText: $localize`+ Add another query`,
          },
          fieldArray: {
            type: 'query',
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
