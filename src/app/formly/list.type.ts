import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { FieldArrayType, FormlyField } from '@ngx-formly/core';
import { cloneDeep, defer, isEqual } from 'lodash-es';
import { Subscription } from 'rxjs';
import { Store } from '../store/store';
import { clipboardPasteValues } from '../util/clipboard';
import { getPath } from '../util/http';
import { hasLocation } from '../util/geo';
import { closedRings, locationLists, locationPicker } from './location-picker';

@Component({
  selector: 'formly-list-section',
  host: {
    '(jasper-clipboard-paste)': 'clipboardPaste($any($event))',
  },
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
        @if (i < size) {
        <div class="form-array list-drag"
             cdkDrag
             [cdkDragData]="model[i]"
             cdkDragRootElement="formly-wrapper-form-field label"
             (cdkDragStarted)="dragEvent(fg, 'jasper-drag-start')"
             (cdkDragEnded)="dragEvent(fg, 'jasper-drag-end')">
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
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CdkDropList,
    CdkScrollable,
    CdkDrag,
    CdkDragHandle,
    FormlyField,
  ],
})
export class ListTypeComponent extends FieldArrayType implements OnInit, OnDestroy {

  dropping = false;

  private ringWatch?: Subscription;

  constructor(
    private store: Store,
  ) {
    super();
  }

  @HostBinding('title')
  get title() {
    return this.props.title || '';
  }

  ngOnInit() {
    // @ts-ignore
    if (this.field.fieldArray?.type === 'location') locationLists.set(this.formControl, this);
    if (!this.props.ring) return;
    const value = this.formControl.value;
    if (value?.length >= 4 && isEqual(value[0], value[value.length - 1])) closedRings.add(this.formControl);
    defer(() => this.closeRing());
    this.ringWatch = this.formControl.valueChanges.subscribe(() => defer(() => this.closeRing()));
  }

  ngOnDestroy() {
    if (locationLists.get(this.formControl) === this) locationLists.delete(this.formControl);
    this.ringWatch?.unsubscribe();
  }

  /**
   * Number of visible items. A closed ring hides its closing position.
   */
  get size() {
    const length = this.field.fieldGroup?.length || 0;
    return closedRings.has(this.formControl) ? length - 1 : length;
  }

  /**
   * Keep rings closed (RFC 7946 3.1.6) by mirroring the first position
   * into a hidden closing position once there are three or more positions.
   */
  private closeRing() {
    if (this.ringWatch?.closed) return;
    const arr = this.formControl;
    const closed = closedRings.has(arr);
    const points = arr.length - (closed ? 1 : 0);
    const first = arr.length ? arr.at(0).value : undefined;
    if (points >= 3) {
      if (!closed) {
        closedRings.add(arr);
        super.add(arr.length, first, { markAsDirty: false });
      } else if (!isEqual(arr.at(arr.length - 1).value, first)) {
        this.model[arr.length - 1] = cloneDeep(first);
        arr.at(arr.length - 1).setValue(cloneDeep(first));
      }
    } else if (closed) {
      closedRings.delete(arr);
      super.remove(arr.length - 1, { markAsDirty: false });
    }
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
      case 'bookmark':
        return 'tag';
    }
    // @ts-ignore
    return this.field.fieldArray?.type;
  }

  override add(index?: number, initialModel?: any, options?: { markAsDirty: boolean }) {
    // @ts-ignore
    this.field.fieldArray.focus = index === undefined && !initialModel;
    if (index === undefined && closedRings.has(this.formControl)) index = this.size;
    // @ts-ignore
    if (initialModel === undefined && this.field.fieldArray?.type === 'location') {
      initialModel = this.seedLocation(index ?? this.size);
    }
    const i = index ?? this.field.fieldGroup?.length ?? 0;
    super.add(index, initialModel, options);
    // @ts-ignore
    if (this.field.fieldArray?.type === 'location') {
      const added = this.field.fieldGroup?.[i];
      const picker = added && locationPicker(added);
      // Select the new location so clicking the map places it
      if (picker?.open && added?.formControl) picker.select(added.formControl);
    }
  }

  /**
   * Start a new location next to its neighbours instead of at [0, 0].
   * In a closed ring use the midpoint of the edge being split, otherwise
   * copy the previous (or next) location.
   */
  private seedLocation(index: number): [number, number] | undefined {
    const values: any[] = (this.formControl.value || []).slice(0, this.size);
    if (closedRings.has(this.formControl) && values.length) {
      const prev = values[(index - 1 + values.length) % values.length];
      const next = values[index % values.length];
      if (hasLocation(prev) && hasLocation(next)) {
        const deltaLng = ((next[0] - prev[0] + 540) % 360) - 180;
        const lng = ((prev[0] + deltaLng / 2 + 540) % 360) - 180;
        return [lng, (prev[1] + next[1]) / 2];
      }
    }
    const neighbour = [values[index - 1], values[index]].find(hasLocation);
    return neighbour && [neighbour[0], neighbour[1]];
  }

  keydown(event: KeyboardEvent, index: number) {
    if (this.groupArray) return;
    if (event.repeat) return;
    const len = this.size;
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
      if (index === len - 1) {
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
    if (index === undefined || index >= this.size) index = this.size - 1;
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

  clipboardPaste(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    for (const value of clipboardPasteValues(event)) {
      this.add(undefined, value);
    }
  }

  /**
   * Notify parent forms when a list item drag starts or ends so they can
   * show empty drop lists before the drop list positions are cached.
   */
  dragEvent(list: HTMLElement, type: 'jasper-drag-start' | 'jasper-drag-end') {
    list.dispatchEvent(new CustomEvent(type, { bubbles: true }));
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
    this.add(event.currentIndex, value);
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
