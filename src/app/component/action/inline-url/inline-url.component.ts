import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { URI_REGEX } from '../../../util/format';
import { ActionComponent } from '../action.component';

@Component({
  standalone: false,
  selector: 'app-inline-url',
  templateUrl: './inline-url.component.html',
  styleUrls: ['./inline-url.component.scss']
})
export class InlineUrlComponent extends ActionComponent {
  @HostBinding('class') css = 'action';
  uriRegex = URI_REGEX.source;

  @Input()
  action: (url: string) => Observable<any|never> = () => of(null);
  @Input()
  value = '';
  @Output()
  error = new EventEmitter<string>();

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
      field.setCustomValidity($localize`Must be a valid URI according to RFC 3986.`)
      field.reportValidity();
      return;
    }
    this.editing = false;
    this.acting = true;
    this.action((field.value || '').trim()).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }

}
