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

  readonly addingText = signal('');
  readonly selectedIndex = signal(-1);
  readonly error = signal('');

  add() {
    this.error.set('');
    if (!this.addingText()) return;
    const list = this.list();
    if (list.includes(this.addingText())) {
      this.error.set('Duplicate name');
      return;
    }
    list.push(this.addingText());
    this.onAdd.emit(this.addingText());
    this.addingText.set('');
    this.select(list.length - 1);
  }

  remove(index: number) {
    const list = this.list();
    this.onRemove.emit(list[index]);
    list.splice(index, 1);
  }

  select(index: number) {
    this.selectedIndex.set(index);
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
