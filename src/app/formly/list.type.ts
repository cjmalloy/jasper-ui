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
            (keydown)="maybeAdd($event, i)"></formly-field>
          <button type="button" (click)="remove(i)" i18n>&ndash;</button>
        </div>
        <formly-error *ngIf="showError" [field]="field"></formly-error>
      </ng-container>
    </div>
  `,
})
export class ListTypeComponent extends FieldArrayType {
  override add(index?: number) {
    // @ts-ignore
    const overrideFocus = !this.field.fieldArray.focus && index === undefined;
    // @ts-ignore
    if (overrideFocus) this.field.fieldArray.focus = true;
    super.add(...arguments);
    // @ts-ignore
    if (overrideFocus) this.field.fieldArray.focus = false;
  }

  maybeAdd(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || this.formControl.length - 1 === index && event.key === 'Tab') {
      event.preventDefault();
      this.add(index);
    }
  }
}
