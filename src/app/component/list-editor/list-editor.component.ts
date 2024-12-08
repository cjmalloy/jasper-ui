import { Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-list-editor',
  templateUrl: './list-editor.component.html',
  styleUrls: ['./list-editor.component.scss']
})
export class ListEditorComponent implements OnInit {
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

  constructor() { }

  ngOnInit(): void {
  }

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
}
