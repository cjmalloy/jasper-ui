import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-list-editor',
  templateUrl: './list-editor.component.html',
  styleUrls: ['./list-editor.component.scss'],
  imports: [ReactiveFormsModule]
})
export class ListEditorComponent{
  @HostBinding('class') css = 'listbox form-group';

  readonly list = input<string[]>([]);
  readonly type = input('email');
  readonly placeholder = input('Add item');
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
    const list = this.list();
    if (list.includes(this.addingText)) {
      this.error = 'Duplicate name';
      return;
    }
    list.push(this.addingText);
    this.onAdd.emit(this.addingText);
    this.addingText = '';
    this.select(list.length - 1);
  }

  remove(index: number) {
    const list = this.list();
    this.onRemove.emit(list[index]);
    list.splice(index, 1);
  }

  select(index: number) {
    this.selectedIndex = index;
    if (index !== -1) {
      this.selected.emit(this.list()[index]);
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
