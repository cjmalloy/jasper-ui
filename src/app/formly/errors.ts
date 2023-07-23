import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyField, FormlyFieldProps } from '@ngx-formly/core';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/models';

@Component({
  selector: 'formly-error',
  host: { 'class': 'error' },
  template: `
    <span *ngIf="field.type === 'url' && field.formControl?.errors?.['pattern'] else tag" i18n>
      Must be a valid URI according to <a target="_blank" href="https://datatracker.ietf.org/doc/html/rfc3986">RFC 3986</a>.
    </span>
    <ng-template #tag>
      <span *ngIf="field.type === 'tag' && field.formControl?.errors?.['pattern'] else qtag" i18n>
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.<br>
        (i.e. "science", "my/tag", or "_my/private/tag")
      </span>
    </ng-template>
    <ng-template #qtag>
      <span *ngIf="field.type === 'qtag' && field.formControl?.errors?.['pattern'] else query" i18n>
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Use the local wildcard (*) to match all tags with a local origin.
        Tags may be qualified with an origin, or the default origin (@).
        Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
        Use an origin without a tag to match all tags at that origin.
        The wildcard origin (@*) by itself will match everything.
        Protected tags start with a plus sign.
        Private tags start with an underscore.<br>
        (i.e. "*", "science", "science@origin" "my/tag@", or "_my/private/tag")
      </span>
    </ng-template>
    <ng-template #query>
      <span *ngIf="field.type === 'query' && field.formControl?.errors?.['pattern'] else selector" i18n>
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
        Private tags start with an underscore.<br>
        (i.e. "science:news", "science@origin science@other" "your/tag my/tag", "!cool", or "news:_my/private/tag")
      </span>
    </ng-template>
    <ng-template #selector>
      <span *ngIf="field.type === 'selector' && field.formControl?.errors?.['pattern'] else user" i18n>
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Use the local wildcard (*) to match all tags with a local origin.
        Tags may be qualified with an origin, or a wildcard origin (@*).
        Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.
        Use an origin without a tag to match all tags at that origin.
        The wildcard origin (@*) by itself will match everything.
        Protected tags start with a plus sign.
        Private tags start with an underscore.<br>
        (i.e. "*", "!science", "science@origin" "my/tag@", or "_my/private/tag")
      </span>
    </ng-template>
    <ng-template #user>
      <span *ngIf="field.type === 'user' && field.formControl?.errors?.['pattern'] else defaultMessage" i18n>
      User tags must start with the "+user/" or "_user/" prefix.
      Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
      tags start with an underscore.<br>
      (i.e. "+user/alice", "_user/bob", or "+user/department/charlie")
      </span>
    </ng-template>
    <ng-template #defaultMessage>
      <formly-validation-message [field]="field"></formly-validation-message>
    </ng-template>
  `,
})
export class FormlyError {
  @Input()
  field!: FormlyFieldConfig;
}
