import { Component, Input } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/models';

@Component({
  selector: 'formly-error',
  host: { 'class': 'error' },
  template: `
    <span *ngIf="field.type === 'url' && field.formControl?.errors?.['pattern'] else tag" i18n>
      Must be a valid URI according to <a target="_blank" href="https://datatracker.ietf.org/doc/html/rfc3986">RFC 3986</a>.
    </span>
    <ng-template #tag>
      <span *ngIf="field.type === 'tag' && field.formControl?.errors?.['pattern'] else origin" i18n>
        Tags must be lower case letters, numbers, periods and forward slashes.<br>
        Must not start with a forward slash or period.<br>
        Must not or contain two forward slashes or periods in a row.<br>
        Protected tags start with a plus sign.<br>
        Private tags start with an underscore.<br>
        (i.e. "science", "my/tag", or "_my/private/tag")
      </span>
    </ng-template>
    <ng-template #origin>
      <span *ngIf="field.type === 'origin' && field.formControl?.errors?.['pattern'] else plugin" i18n>
        Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.<br>
        The default origin is blank.<br>
        (i.e. "@origin", "@my.origin", or "")
      </span>
    </ng-template>
    <ng-template #plugin>
      <span *ngIf="field.type === 'plugin' && field.formControl?.errors?.['pattern'] else qtag" i18n>
        Plugin tags must start with the "plugin/", "+plugin/" or "_plugin/" prefix.<br>
        Tags must be lower case letters, numbers, periods and forward slashes.<br>
        Must not start with a forward slash or period.<br>
        Must not or contain two forward slashes or periods in a row.<br>
        Protected tags start with a plus sign.<br>
        Private tags start with an underscore.<br>
        (i.e. "plugin/thumbnail", "plugin/image" "+plugin/feed", or "_plugin/admin")
      </span>
    </ng-template>
    <ng-template #qtag>
      <span *ngIf="field.type === 'qtag' && field.formControl?.errors?.['pattern'] else query" i18n>
        Tags must be lower case letters, numbers, periods and forward slashes.<br>
        Must not start with a forward slash or period.<br>
        Must not or contain two forward slashes or periods in a row.<br>
        Tags may be qualified with an origin.<br>
        Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.<br>
        Protected tags start with a plus sign.<br>
        Private tags start with an underscore.<br>
        (i.e. "science", "science@origin" "my/tag", or "_my/private/tag")
      </span>
    </ng-template>
    <ng-template #query>
      <span *ngIf="field.type === 'query' && field.formControl?.errors?.['pattern'] else selector" i18n>
        Queries support AND (:), OR (|), NOT (!) and grouping qualified tags (parentheses).<br>
        Tags must be lower case letters, numbers, periods and forward slashes.<br>
        Must not start with a forward slash or period.<br>
        Must not or contain two forward slashes or periods in a row.<br>
        Use the local wildcard (*) to match all tags with a local origin.<br>
        Tags may be qualified with an origin, or a wildcard origin (@*).<br>
        Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.<br>
        Use an origin without a tag to match all tags at that origin.<br>
        The wildcard origin (@*) by itself will match everything.<br>
        Protected tags start with a plus sign.<br>
        Private tags start with an underscore.<br>
        (i.e. "science:news", "science@origin science@other" "your/tag my/tag", "!cool", or "news:_my/private/tag")
      </span>
    </ng-template>
    <ng-template #selector>
      <span *ngIf="field.type === 'selector' && field.formControl?.errors?.['pattern'] else user" i18n>
        Tags must be lower case letters, numbers, periods and forward slashes.<br>
        Must not start with a forward slash or period.<br>
        Must not or contain two forward slashes or periods in a row.<br>
        Use the local wildcard (*) to match all tags with a local origin.<br>
        Tags may be qualified with an origin, or a wildcard origin (@*).<br>
        Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.<br>
        Use an origin without a tag to match all tags at that origin.<br>
        The wildcard origin (@*) by itself will match everything.<br>
        Protected tags start with a plus sign.<br>
        Private tags start with an underscore.<br>
        (i.e. "*", "science", "science@origin" "my/tag@", or "_my/private/tag")
      </span>
    </ng-template>
    <ng-template #user>
      <span *ngIf="field.type === 'user' && field.formControl?.errors?.['pattern'] else quser" i18n>
        User tags must start with the "+user/" or "_user/" prefix.<br>
        Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
        tags start with an underscore.<br>
        (i.e. "+user/alice", "_user/bob", or "+user/department/charlie")
      </span>
    </ng-template>
    <ng-template #quser>
      <span *ngIf="field.type === 'quser' && field.formControl?.errors?.['pattern'] else defaultMessage" i18n>
        User tags must start with the "+user/" or "_user/" prefix.<br>
        Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
        tags start with an underscore.<br>
        Tags may be qualified with an origin.<br>
        Origins must start with an at sign (@) and contain only lowercase letters, numbers, and periods.<br>
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
