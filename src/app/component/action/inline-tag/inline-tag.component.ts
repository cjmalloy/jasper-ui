import { Component, EventEmitter, Input, Output } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { TAGS_REGEX } from '../../../util/format';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-tag',
  templateUrl: './inline-tag.component.html',
  styleUrls: ['./inline-tag.component.scss']
})
export class InlineTagComponent extends ActionComponent {
  tagRegex = TAGS_REGEX.source;

  @Input()
  action: (tag: string) => Observable<any|never> = () => of(null);
  @Output()
  error = new EventEmitter<string>();

  editing = false;
  tagging = false;

  override reset() {
    this.editing = false;
    this.tagging = false;
  }

  override active() {
    return this.editing || this.tagging;
  }

  addInlineTag(field: HTMLInputElement) {
    if (field.validity.patternMismatch) {
      this.error.next($localize`
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.`);
      return;
    }
    this.editing = false;
    this.tagging = true;
    this.action((field.value || ''.trim())).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.tagging = false);
  }

}
