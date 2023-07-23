import { Component } from '@angular/core';
import { FieldArrayType } from '@ngx-formly/core';

@Component({
  selector: 'formly-list-section',
  template: `
    <label>{{ props.label || '' }}</label>
    <div class="form-group">
      <button type="button" (click)="add()">{{ props.addText }}</button>
      <ng-container *ngFor="let field of field.fieldGroup; let i = index">
        <div class="form-array">
          <formly-field
            class="grow hide-errors"
            [field]="field"
            (focusout)="!$any($event.target).value && remove(i)"
            (keydown)="maybeAdd($event, formControl.length - 1 === i)"></formly-field>
          <button type="button" (click)="remove(i)" i18n>&ndash;</button>
        </div>
        <div class="error" *ngIf="showError">
          <span *ngIf="field.type === 'url' && field.formControl?.errors?.['pattern'] else defaultMessage" i18n>
            Must be a valid URI according to <a target="_blank" href="https://datatracker.ietf.org/doc/html/rfc3986">RFC 3986</a>.
          </span>
          <ng-template #defaultMessage>
            <formly-validation-message [field]="field"></formly-validation-message>
          </ng-template>
        </div>
      </ng-container>
    </div>
  `,
})
export class ListTypeComponent extends FieldArrayType {
  override add() {
    // @ts-ignore
    this.field.fieldArray.focus = true;
    super.add(...arguments);
    // @ts-ignore
    this.field.fieldArray.focus = false;
  }

  maybeAdd(event: KeyboardEvent, last: boolean) {
    if (event.key === 'Enter' || last && event.key === 'Tab') {
      event.preventDefault();
      this.add();
    }
  }
}
