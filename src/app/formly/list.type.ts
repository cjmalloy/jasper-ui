import { Component, HostBinding } from '@angular/core';
import { FieldArrayType } from '@ngx-formly/core';
import { defer } from 'lodash-es';

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
            (focusout)="maybeRemove($event, i)"
            (keydown)="keydown($event, i)"></formly-field>
          <button type="button" (click)="remove(i)" i18n>&ndash;</button>
        </div>
        <formly-error *ngIf="showError" [field]="field"></formly-error>
      </ng-container>
    </div>
  `,
})
export class ListTypeComponent extends FieldArrayType {
  @HostBinding('title')
  get title() {
    return this.props.title || '';
  }

  override add(index?: number) {
    super.add(...arguments);
    this.focus(index);
  }

  keydown(event: KeyboardEvent, index: number) {
    // @ts-ignore
    if (this.field.fieldArray.fieldGroup) return;
    if (event.key === 'Enter' || this.formControl.length - 1 === index && event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      this.add(index + 1);
    }
    if (!this.model[index] && event.key === 'Backspace') {
      event.preventDefault();
      if (index === 0) {
        this.remove(index);
        this.focus(index);
      } else {
        this.focus(index - 1, true);
      }
    }
    if (!this.model[index] && event.key === 'Delete') {
      event.preventDefault();
      if (index === this.field.fieldGroup!.length - 1) {
        this.remove(index);
        this.focus(index - 1);
      } else {
        this.focus(index + 1, true);
      }
    }
  }

  maybeRemove(event: FocusEvent, i: number) {
    // @ts-ignore
    if (this.field.fieldArray.fieldGroup) return;
    if (!(event.target as any).value) this.remove(i);
  }

  focus(index?: number, select = false) {
    if (this.field.fieldGroup?.length === 0) return;
    if (index === undefined || index >= this.field.fieldGroup!.length) index = this.field.fieldGroup!.length - 1;
    if (index < 0) index = 0;
    const selector = '#' + this.field.fieldGroup![index].id;
    defer(() => {
      const el = document.querySelector(selector) as HTMLInputElement;
      el.focus();
      if (select) {
        el.setSelectionRange(0, el.value.length);
      }
    });
  }
}
