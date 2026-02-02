import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, HostBinding } from '@angular/core';
import { FieldArrayType, FormlyField } from '@ngx-formly/core';
import { defer } from 'lodash-es';
import { Store } from '../store/store';
import { getPath } from '../util/http';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'formly-list-section',
  template: `
    <label [class.no-margin]="props.showLabel === false">{{ props.showLabel !== false && props.label || '' }}</label>
    <div #fg
         class="form-group"
         cdkDropList
         cdkScrollable
         [cdkDropListData]="this"
         (cdkDropListDropped)="drop($any($event))"
         [class.dropping]="dropping"
         (drop)="dnd($event)"
         (dragenter)="dropping = true"
         (dragleave)="dragLeave(fg, $any($event.target))">
      @if (props.showAdd !== false) {
        <button type="button" (click)="add()">{{ props.addText }}</button>
      }
      @for (field of field.fieldGroup; track field.id; let i = $index) {
        <div class="form-array list-drag"
             cdkDrag
             [cdkDragData]="model[i]"
             cdkDragRootElement="formly-wrapper-form-field label">
          @if (groupArray) {
            <div cdkDragHandle class="drag-handle"></div>
          }
          <formly-field class="grow"
                        [field]="field"
                        (focusout)="maybeRemove($event, i)"
                        (keydown)="keydown($event, i)"></formly-field>
          <button type="button" (click)="remove(i)" i18n>&ndash;</button>
        </div>
      }
    </div>
  `,
  imports: [
    CdkDropList,
    CdkScrollable,
    CdkDrag,
    CdkDragHandle,
    FormlyField,
  ],
})
export class ListTypeComponent extends FieldArrayType {

  dropping = false;

  constructor(
    private store: Store,
  ) {
    super();
  }

  @HostBinding('title')
  get title() {
    return this.props.title || '';
  }

  get groupArray() {
    // @ts-ignore
    return this.field.fieldArray.fieldGroup;
  }

  get type() {
    // @ts-ignore
    switch(this.field.fieldArray?.type) {
      case 'url':
      case 'ref':
      case 'pdf':
      case 'qr':
      case 'audio':
      case 'video':
      case 'image':
        return 'ref';
      case 'tag':
      case 'qtag':
      case 'user':
      case 'quser':
      case 'query':
      case 'selector':
      case 'plugin':
      case 'template':
        return 'tag';
    }
    // @ts-ignore
    return this.field.fieldArray?.type;
  }

  override add(index?: number, initialModel?: any) {
    // @ts-ignore
    this.field.fieldArray.focus = index === undefined && !initialModel;
    super.add(...arguments);
  }

  keydown(event: KeyboardEvent, index: number) {
    if (this.groupArray) return;
    if (event.repeat) return;
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

  /**
   * Remove blank inputs on blur.
   */
  maybeRemove(event: FocusEvent, i: number) {
    if (this.groupArray) return;
    const input = event.target as HTMLInputElement;
    if (input.tagName !== 'INPUT') return;
    if (input.classList.contains('preview')) return;
    if (!input.value) this.remove(i);
  }

  focus(index?: number, select = false) {
    if (this.groupArray) return;
    if (this.field.fieldGroup?.length === 0) return;
    if (index === undefined || index >= this.field.fieldGroup!.length) index = this.field.fieldGroup!.length - 1;
    if (index < 0) index = 0;
    defer(() => {
      const selector = '#' + this.field.fieldGroup![index].id;
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
    if (!this.store.hotkey || event.previousContainer === event.container) {
      event.previousContainer.data.remove(event.previousIndex);
    }
    let value = event.item.data;
    if (event.previousContainer.data.type === 'ref' && event.container.data.type === 'tag') {
      let path = getPath(value) || value;
      // @ts-ignore
      if (value.startsWith(window.configService.base)) {
        // @ts-ignore
        path = value.substring(window.configService.base.length);
        if (!path.startsWith('/')) path = '/' + path;
      }
      if (path.startsWith('/ref/')) path = path.substring('/ref/'.length);
      if (path.startsWith('tag:/')) {
        value = path.substring('tag:/'.length);
      } else if (value.startsWith('tag:/')) {
        value = value.substring('tag:/'.length);
      }
    } else if (event.previousContainer.data.type === 'tag' && event.container.data.type === 'ref') {
      value = 'tag:/' + value;
    }
    super.add(event.currentIndex, value);
  }

  dnd(event: DragEvent) {
    this.dropping = false;
    event.preventDefault();
    event.stopPropagation();
    const items = event.dataTransfer?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind !== 'string') continue;
      if (d?.type !== 'text/plain') continue;
      d.getAsString(url => {
        let path = getPath(url) || url;
        // @ts-ignore
        if (url.startsWith(window.configService.base)) {
          // @ts-ignore
          path = url.substring(window.configService.base.length);
          if (!path.startsWith('/')) path = '/' + path;
        }
        if (path.startsWith('/ref/')) path = path.substring('/ref/'.length);
        if (path.startsWith('/tag/')) {
          if (this.type == 'ref') {
            this.add(undefined, 'tag:' + path.substring('/tag'.length));
          } else {
            this.add(undefined, path.substring('/tag/'.length));
          }
        } else if (path.startsWith('tag:/')) {
          if (this.type == 'ref') {
            this.add(undefined, path);
          } else {
            this.add(undefined, path.substring('tag:/'.length));
          }
        } else if (url.startsWith('tag:/')) {
          if (this.type == 'ref') {
            this.add(undefined, url);
          } else {
            this.add(undefined, url.substring('tag:/'.length));
          }
        } else {
          this.add(undefined, url);
        }
      });
    }
  }

  dragLeave(parent: HTMLElement, target: HTMLElement) {
    if (this.dropping && parent === target || !parent.contains(target)) {
      this.dropping = false;
    }
  }
}
