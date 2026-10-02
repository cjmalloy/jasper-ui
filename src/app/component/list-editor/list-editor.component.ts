import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-list-editor',
  templateUrl: './list-editor.component.html',
  styleUrls: ['./list-editor.component.scss'],
  host: { 'class': 'listbox form-group' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class ListEditorComponent {

  readonly list = input<string[]>([]);
  readonly type = input('email');
  readonly placeholder = input('Add item');
  readonly onAdd = output<string>();
  readonly onRemove = output<string>();
  readonly selected = output<string | undefined>();

  private readonly _addingText = signal('');
  private readonly _selectedIndex = signal(-1);
  private readonly _error = signal('');

  get addingText() { return this._addingText(); }
  set addingText(value: string) { this._addingText.set(value); }
  get selectedIndex() { return this._selectedIndex(); }
  set selectedIndex(value: number) { this._selectedIndex.set(value); }
  get error() { return this._error(); }
  set error(value: string) { this._error.set(value); }

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
