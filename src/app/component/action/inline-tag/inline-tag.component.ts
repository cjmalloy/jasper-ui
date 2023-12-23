import { Component, HostBinding, Input } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { TAGS_REGEX } from '../../../util/format';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-tag',
  templateUrl: './inline-tag.component.html',
  styleUrls: ['./inline-tag.component.scss']
})
export class InlineTagComponent extends ActionComponent {
  @HostBinding('class') css = 'action';
  tagRegex = TAGS_REGEX.source;

  @Input()
  action: (tag: string) => Observable<any|never> = () => of(null);

  editing = false;
  acting = false;

  override reset() {
    this.editing = false;
    this.acting = false;
  }

  override active() {
    return this.editing || this.acting;
  }

  save(field: HTMLInputElement) {
    if (field.validity.patternMismatch) {
      field.setCustomValidity($localize`
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.`)
      field.reportValidity();
      return;
    }
    this.editing = false;
    this.acting = true;
    this.action((field.value || '').toLowerCase().trim()).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }

}
