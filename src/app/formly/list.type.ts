import { Component, HostBinding } from '@angular/core';
import { FieldArrayType } from '@ngx-formly/core';
import { defer } from 'lodash-es';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'formly-list-section',
  template: `
    <label>{{ props.label || '' }}</label>
    <div class="form-group"
         cdkDropList
         cdkScrollable
         (cdkDropListDropped)="drop($any($event))">
      <button type="button" (click)="add()">{{ props.addText }}</button>
      <ng-container *ngFor="let field of field.fieldGroup; let i = index">
        <div class="form-array list-drag"
             cdkDrag>
          <formly-field
            class="grow"
            [class.hide-errors]="!groupArray"
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

  get groupArray() {
    // @ts-ignore
    return this.field.fieldArray.fieldGroup;
  }

  override add(index?: number, ...rest: any[]) {
    super.add(...arguments);
    this.focus(index);
  }

  keydown(event: KeyboardEvent, index: number) {
    if (this.groupArray) return;
    if (!event.shiftKey) {
      if (event.key === 'Enter' || event.key === 'Tab' && this.formControl.length - 1 === index) {
        event.preventDefault();
        // @ts-ignore
        if (!event.target?.value) return;
        this.add(index + 1);
        this.focus(index + 1);
      }
    } else {
      if (event.key === 'Enter' || event.key === 'Tab' && index === 0) {
        event.preventDefault();
        // @ts-ignore
        if (!event.target?.value) return;
        this.add(index);
      }
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
    if (this.groupArray) return;
    if (!(event.target as any).value) this.remove(i);
  }

  focus(index?: number, select = false) {
    if (this.groupArray) return;
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

  drop(event: CdkDragDrop<any>) {
    const moved = this.model[event.previousIndex];
    this.remove(event.previousIndex);
    this.add(event.currentIndex - (event.currentIndex <= event.previousIndex ? 0 : 1), moved);
  }
}
