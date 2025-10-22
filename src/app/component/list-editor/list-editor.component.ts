import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';

@Component({
    selector: 'app-list-editor',
    templateUrl: './list-editor.component.html',
    styleUrls: ['./list-editor.component.scss'],
    imports: [ReactiveFormsModule, FormsModule, NgIf, NgFor]
})
export class ListEditorComponent{
  @HostBinding('class') css = 'listbox form-group';

  @Input()
  list: string[] = [];
  @Input()
  type = 'email';
  @Input()
  placeholder = 'Add item';
  @Output()
  onAdd = new EventEmitter<string>();
  @Output()
  onRemove = new EventEmitter<string>();
  @Output()
  selected = new EventEmitter<string>();

  addingText = '';
  selectedIndex = -1;

  error = '';

  add() {
    this.error = '';
    if (!this.addingText) return;
    if (this.list.includes(this.addingText)) {
      this.error = 'Duplicate name';
      return;
    }
    this.list.push(this.addingText);
    this.onAdd.emit(this.addingText);
    this.addingText = '';
    this.select(this.list.length - 1);
  }

  remove(index: number) {
    this.onRemove.emit(this.list[index]);
    this.list.splice(index, 1);
  }

  select(index: number) {
    this.selectedIndex = index;
    if (index !== -1) {
      this.selected.emit(this.list[index]);
    } else {
      this.selected.emit(undefined);
    }
  }

  keydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.add();
      event.preventDefault();
    }
  }
}
