import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, HostBinding } from '@angular/core';
import { FieldArrayType } from '@ngx-formly/core';
import { defer } from 'lodash-es';
import { Store } from '../store/store';
import { getPath } from '../util/http';

@Component({
  standalone: false,
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

  override add(index?: number, initialModel?: any) {
    // @ts-ignore
    this.field.fieldArray.focus = index === undefined && !initialModel;
    super.add(...arguments);
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
    super.add(event.currentIndex, event.item.data);
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
        if (path.startsWith('/tag/')) {
          // @ts-ignore
          switch(this.field.fieldArray?.type) {
            case 'url':
            case 'ref':
            case 'pdf':
            case 'qr':
            case 'audio':
            case 'video':
            case 'image':
              this.add(undefined, 'tag:' + path.substring('/tag'.length));
              return;
          }
          this.add(undefined, path.substring('/tag/'.length));
        } else if (path.startsWith('/ref/')) {
          this.add(undefined, path.substring('/ref/'.length));
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
