import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-list-editor',
  templateUrl: './list-editor.component.html',
  styleUrls: ['./list-editor.component.scss']
})
export class ListEditorComponent implements OnInit {

  @Input()
  list: string[] = [];
  @Input()
  type = 'email';
  @Output()
  onAdd = new EventEmitter<string>();
  @Output()
  onRemove = new EventEmitter<string>();
  @Output()
  selected = new EventEmitter<string>();

  addingText = '';

  constructor() { }

  ngOnInit(): void {
  }

  add() {
    if (!this.addingText) return;
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
    if (index !== -1) {
      this.selected.emit(this.list[index]);
    } else {
      this.selected.emit(undefined);
    }
  }
}
