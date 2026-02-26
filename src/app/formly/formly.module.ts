import { DragDropModule } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { NgModule } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { FormlyExtension, FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { FormlySelectModule } from '@ngx-formly/core/select';
import { v4 as uuid } from 'uuid';
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
import { FormlyWrapperFormGroup } from './form-group.wrapper';
import { ImageUploadComponent } from './image-upload/image-upload.component';
import { FormlyFieldInput } from './input.type';
import { ListTypeComponent } from './list.type';
import { FormlyFieldMultiCheckbox } from './multicheckbox.type';
import { PdfUploadComponent } from './pdf-upload/pdf-upload.component';
import { QrScannerComponent } from './qr-scanner/qr-scanner.component';
import { FormlyFieldBookmarkInput } from './bookmark.type';
import { FormlyFieldQueryInput } from './query.type';
import { FormlyFieldRadio } from './radio.type';
import { FormlyFieldRange } from './range.type';
import { FormlyFieldRefInput } from './ref.type';
import { FormlyFieldSelect } from './select.type';
import { FormlyFieldTagInput } from './tag.type';
import { FormlyFieldTextArea } from './textarea.type';
import { VideoUploadComponent } from './video-upload/video-upload.component';

export class IdPrefixExtension implements FormlyExtension {
  prePopulate(field: FormlyFieldConfig) {
    if (field.key && !field.id) {
      field.id = `formly-${uuid()}-${field.key}`;
    }
    if (field.key && !field.name) {
      field.name = field.key as string;
    }
    // Recurse for nested fields
    field.fieldGroup?.forEach(f => this.prePopulate(f));
    if (field.fieldArray) {
      this.prePopulate(field.fieldArray as FormlyFieldConfig);
    }
  }
}

@NgModule({
  exports: [
    QrScannerComponent,
    AudioUploadComponent,
    VideoUploadComponent,
    ImageUploadComponent,
    PdfUploadComponent,
  ],
  imports: [
    ReactiveFormsModule,
    DragDropModule,
    OverlayModule,
    FormlySelectModule,
    FormlyWrapperFormField,
    FormlyFieldInput,
    FormlyFieldRange,
    FormlyFieldTagInput,
    FormlyFieldQueryInput,
    FormlyFieldBookmarkInput,
    FormlyFieldRefInput,
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
    PdfUploadComponent,
    ListTypeComponent,
    FormlyModule.forRoot({
      extensions: [{ name: 'id-prefix', extension: new IdPrefixExtension() }],
      validationMessages: [
        { name: 'required', message: 'This field is required' },
      ],
      wrappers: [{
        name: 'form-field',
        component: FormlyWrapperFormField,
      }, {
        name: 'form-group',
        component: FormlyWrapperFormGroup,
      }],
      types: [{
        name: 'list',
        component: ListTypeComponent,
      }, {
        name: 'input',
        component: FormlyFieldInput,
        wrappers: ['form-field'],
      }, {
        name: 'range',
        component: FormlyFieldRange,
        wrappers: ['form-field'],
        defaultOptions: {
          defaultValue: 0,
          props: {
            min: 0,
            max: 10,
            step: 1,
          }
        }
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
            clear: true,
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
        name: 'ref',
        component: FormlyFieldRefInput,
        wrappers: ['form-field'],
        defaultOptions: {
          props: {
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
        name: 'refs',
        extends: 'list',
        defaultOptions: {
          props: {
            showLabel: true,
            label: $localize`URLs: `,
            showAdd: true,
            addText: $localize`+ Add another URL`,
          },
          fieldArray: {
            type: 'ref',
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
            datalist: [
              { value: 'PT1M', label: $localize`1 min` },
              { value: 'PT5M', label: $localize`5 mins` },
              { value: 'PT15M', label: $localize`15 mins` },
              { value: 'PT30M', label: $localize`30 mins` },
              { value: 'PT30M', label: $localize`30 mins` },
              { value: 'PT1H', label: $localize`1 hour` },
              { value: 'PT2H', label: $localize`2 hours` },
              { value: 'PT6H', label: $localize`6 hours` },
              { value: 'PT12H', label: $localize`12 hours` },
              { value: 'PT24H', label: $localize`1 day` },
            ],
          },
        },
      }, {
        name: 'image',
        extends: 'ref',
        defaultOptions: {
          props: {
            label: $localize`Image:`,
          },
        },
      }, {
        name: 'video',
        extends: 'ref',
        defaultOptions: {
          props: {
            label: $localize`Video:`,
          },
        },
      }, {
        name: 'audio',
        extends: 'ref',
        defaultOptions: {
          props: {
            label: $localize`Audio:`,
          },
        },
      }, {
        name: 'pdf',
        extends: 'ref',
      }, {
        name: 'qr',
        extends: 'ref',
      }, {
        name: 'tag',
        component: FormlyFieldTagInput,
        wrappers: ['form-field'],
        defaultOptions: {
          props: {
            type: 'email',
            label: $localize`Tag:`,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || TAG_REGEX.test(c.value),
              message: $localize`Tags must be lower case letters, numbers, periods and forward slashes.
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
            label: $localize`@`,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || ORIGIN_REGEX.test(c.value),
              message: $localize`Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
The default origin is blank.
Must not start with a period or contain two periods in a row.
(i.e. "@origin", "@my.origin", or "").`,
            }
          },
        },
      }, {
        name: 'plugin',
        extends: 'tag',
        defaultOptions: {
          props: {
            type: 'email',
            label: $localize`Plugin:`,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || PLUGIN_REGEX.test(c.value),
              message: $localize`Plugin tags must start with the "plugin/", "+plugin/" or "_plugin/" prefix.
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
        name: 'template',
        extends: 'tag',
        defaultOptions: {
          props: {
            type: 'email',
            label: $localize`Template:`,
            required: false,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || TAG_REGEX.test(c.value),
              message: $localize`Templates must be lower case letters, numbers, periods and forward slashes.
The root template is blank.
Must not start with a forward slash or period.
Must not or contain two forward slashes or periods in a row.
Protected tags start with a plus sign.
Private tags start with an underscore.
(i.e. "", "science", "my/tag", or "_my/private/tag")`,
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
              message: $localize`Tags must be lower case letters, numbers, periods and forward slashes.
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
              message: $localize`User tags must start with the "+user/" or "_user/" prefix.
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
              message: $localize`User tags must start with the "+user/" or "_user/" prefix.
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
              message: $localize`Tags must be lower case letters, numbers, periods and forward slashes.
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
        component: FormlyFieldQueryInput,
        wrappers: ['form-field'],
        defaultOptions: {
          props: {
            label: $localize`Query: `,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => !c.value || QUERY_REGEX.test(c.value),
              message: $localize`Queries support AND (:), OR (|), NOT (!) and grouping qualified tags (parentheses).
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
        name: 'bookmark',
        component: FormlyFieldBookmarkInput,
        wrappers: ['form-field'],
        defaultOptions: {
          props: {
            label: $localize`Bookmark: `,
          },
          validators: {
            pattern: {
              expression: (c: AbstractControl) => {
                if (!c.value) return true;
                const query = c.value.split('?')[0];
                return !query || QUERY_REGEX.test(query);
              },
              message: $localize`Queries support AND (:), OR (|), NOT (!) and grouping qualified tags (parentheses).
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
        name: 'bookmarks',
        extends: 'selectors',
        defaultOptions: {
          props: {
            label: $localize`Bookmarks: `,
            addText: $localize`+ Add another bookmark`,
          },
          fieldArray: {
            type: 'bookmark',
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
