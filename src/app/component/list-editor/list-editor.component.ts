import { Component, input, linkedSignal, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-list-editor',
  templateUrl: './list-editor.component.html',
  styleUrls: ['./list-editor.component.scss'],
  host: { 'class': 'listbox form-group' },
  imports: [ReactiveFormsModule]
})
export class ListEditorComponent {

  readonly listInput = input<string[]>([], { alias: 'list' });
  readonly list = linkedSignal(() => [...this.listInput()]);
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
    const list = [...this.list()];
    if (list.includes(this.addingText())) {
      this.error.set('Duplicate name');
      return;
    }
    list.push(this.addingText());
    this.list.set(list);
    this.onAdd.emit(this.addingText());
    this.addingText.set('');
    this.select(list.length - 1);
  }

  remove(index: number) {
    const list = [...this.list()];
    this.onRemove.emit(list[index]);
    list.splice(index, 1);
    this.list.set(list);
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
