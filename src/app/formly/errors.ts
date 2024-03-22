import { Component, Input } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/models';

@Component({
  selector: 'formly-error',
  host: { 'class': 'error' },
  template: `
    @if (field.formControl?.errors?.['pattern']) {
      @switch (field.type) {
        @case ("url") {
          <span i18n>
            Must be a valid URI according to <a target="_blank" href="https://datatracker.ietf.org/doc/html/rfc3986">RFC 3986</a>.
          </span>
        }
        @case ("tag") {
          <span i18n>
            Tags must be lower case letters, numbers, periods and forward slashes.<br>
            Must not start with a forward slash or period.<br>
            Must not or contain two forward slashes or periods in a row.<br>
            Protected tags start with a plus sign.<br>
            Private tags start with an underscore.<br>
            (i.e. "science", "my/tag", or "_my/private/tag")
          </span>
        }
        @case ("origin") {
          <span i18n>
            Origins must start with an at sign (&#64;) and contain only lowercase letters, numbers, and periods.<br>
            The default origin is blank.<br>
            (i.e. "&#64;origin", "&#64;my.origin", or "")
          </span>
        }
        @case ("plugin") {
          <span i18n>
            Plugin tags must start with the "plugin/", "+plugin/" or "_plugin/" prefix.<br>
            Tags must be lower case letters, numbers, periods and forward slashes.<br>
            Must not start with a forward slash or period.<br>
            Must not or contain two forward slashes or periods in a row.<br>
            Protected tags start with a plus sign.<br>
            Private tags start with an underscore.<br>
            (i.e. "plugin/thumbnail", "plugin/image" "+plugin/feed", or "_plugin/admin")
          </span>
        }
        @case ("qtag") {
          <span i18n>
            Tags must be lower case letters, numbers, periods and forward slashes.<br>
            Must not start with a forward slash or period.<br>
            Must not or contain two forward slashes or periods in a row.<br>
            Tags may be qualified with an origin.<br>
            Origins must start with an at sign (&#64;) and contain only lowercase letters, numbers, and periods.<br>
            Protected tags start with a plus sign.<br>
            Private tags start with an underscore.<br>
            (i.e. "science", "science&#64;origin" "my/tag", or "_my/private/tag")
          </span>
        }
        @case ("query") {
          <span i18n>
            Queries support AND (:), OR (|), NOT (!) and grouping qualified tags (parentheses).<br>
            Tags must be lower case letters, numbers, periods and forward slashes.<br>
            Must not start with a forward slash or period.<br>
            Must not or contain two forward slashes or periods in a row.<br>
            Use the local wildcard (*) to match all tags with a local origin.<br>
            Tags may be qualified with an origin, or a wildcard origin (&#64;*).<br>
            Origins must start with an at sign (&#64;) and contain only lowercase letters, numbers, and periods.<br>
            Use an origin without a tag to match all tags at that origin.<br>
            The wildcard origin (&#64;*) by itself will match everything.<br>
            Protected tags start with a plus sign.<br>
            Private tags start with an underscore.<br>
            (i.e. "science:news", "science&#64;origin science&#64;other" "your/tag my/tag", "!cool", or "news:_my/private/tag")
          </span>
        }
        @case ("selector") {
          <span i18n>
            Tags must be lower case letters, numbers, periods and forward slashes.<br>
            Must not start with a forward slash or period.<br>
            Must not or contain two forward slashes or periods in a row.<br>
            Use the local wildcard (*) to match all tags with a local origin.<br>
            Tags may be qualified with an origin, or a wildcard origin (&#64;*).<br>
            Origins must start with an at sign (&#64;) and contain only lowercase letters, numbers, and periods.<br>
            Use an origin without a tag to match all tags at that origin.<br>
            The wildcard origin (&#64;*) by itself will match everything.<br>
            Protected tags start with a plus sign.<br>
            Private tags start with an underscore.<br>
            (i.e. "*", "science", "science&#64;origin" "my/tag&#64;", or "_my/private/tag")
          </span>
        }
        @case ("user") {
          <span i18n>
            User tags must start with the "+user/" or "_user/" prefix.<br>
            Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
            tags start with an underscore.<br>
            (i.e. "+user/alice", "_user/bob", or "+user/department/charlie")
          </span>
        }
        @case ("quser") {
          <span i18n>
            User tags must start with the "+user/" or "_user/" prefix.<br>
            Tags must be lower case letters and forward slashes. Must not start with a slash or contain two forward slashes in a row. Private
            tags start with an underscore.<br>
            Tags may be qualified with an origin.<br>
            Origins must start with an at sign (&#64;) and contain only lowercase letters, numbers, and periods.<br>
            (i.e. "+user/alice", "_user/bob", or "+user/department/charlie")
          </span>
        }
        @default {
          <formly-validation-message [field]="field"></formly-validation-message>
        }
      }
    } @else {
      <formly-validation-message [field]="field"></formly-validation-message>
    }
  `,
})
export class FormlyError {
  @Input()
  field!: FormlyFieldConfig;
}
