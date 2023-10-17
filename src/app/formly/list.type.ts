import { Component, HostBinding, HostListener } from '@angular/core';
import { FieldArrayType } from '@ngx-formly/core';
import { defer } from 'lodash-es';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'formly-list-section',
  template: `
    <label [class.no-margin]="props.showLabel === false">{{ props.showLabel !== false && props.label || '' }}</label>
    <div class="form-group"
         cdkDropList
         cdkScrollable
         [cdkDropListData]="this"
         (cdkDropListDropped)="drop($any($event))">
      <button *ngIf="props.showAdd !== false" type="button" (click)="add()">{{ props.addText }}</button>
      <ng-container *ngFor="let field of field.fieldGroup; let i = index">
        <div class="form-array list-drag"
             cdkDrag
             [cdkDragData]="model[i]"
             cdkDragRootElement="formly-wrapper-form-field label">
          <div *ngIf="groupArray" cdkDragHandle class="drag-handle"></div>
          <formly-field class="grow"
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
  private crtl = false;

  @HostBinding('title')
  get title() {
    return this.props.title || '';
  }

  get groupArray() {
    // @ts-ignore
    return this.field.fieldArray.fieldGroup;
  }

  override add(index?: number) {
    super.add(...arguments);
    this.focus(index);
  }

  @HostListener('window:keydown', ['$event'])
  windowKeydown(e: KeyboardEvent) {
    this.crtl = e.ctrlKey;
  }

  @HostListener('window:keyup', ['$event'])
  windowKeyup(e: KeyboardEvent) {
    this.crtl = e.ctrlKey;
  }

  keydown(event: KeyboardEvent, index: number) {
    if (this.groupArray) return;
    const len = this.formControl.length;
    if (!event.shiftKey) {
      if (event.key === 'Enter' || event.key === 'Tab' && len - 1 === index) {
        if (!this.model[index]) {
          if (event.key === 'Enter') {
            if (len === 1) {
              this.blur();
            } else {
              this.focus(len - 1 === index ? len - 2 : (index + 1));
            }
            event.preventDefault();
          }
          return;
        }
        event.preventDefault();
        this.add(index + 1);
        this.focus(index + 1);
      }
    } else {
      if (event.key === 'Enter' || event.key === 'Tab' && index === 0) {
        if (!this.model[index]) {
          if (event.key === 'Enter') {
            if (len === 1) {
              this.blur();
            } else {
              this.focus(!index ? 1 : (index - 1));
            }
            event.preventDefault();
          }
          return;
        }
        event.preventDefault();
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

  blur() {
    const selector = '#' + this.field.fieldGroup![0].id;
    defer(() => {
      const el = document.querySelector(selector) as HTMLInputElement;
      el.blur();
    });
  }

  drop(event: CdkDragDrop<ListTypeComponent>) {
    if (!this.crtl || event.previousContainer === event.container) {
      event.previousContainer.data.remove(event.previousIndex);
    }
    super.add(event.currentIndex, event.item.data);
  }
}
