import { controlValue } from '../../util/form';
import { computed, Component, effect, input, signal, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { mapValues } from 'lodash-es';
import { ListEditorComponent } from '../../component/list-editor/list-editor.component';
import { newTheme } from '../../util/theme';
import { CodeComponent } from '../code/code.component';

@Component({
  selector: 'app-themes',
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.scss'],
  host: { 'class': 'form-group' },
  imports: [ListEditorComponent, CodeComponent]
})
export class ThemesFormComponent {
  private fb = inject(UntypedFormBuilder);

  private readonly rootControlState = controlValue(() => this.group());


  readonly fieldName = input('themes');
  readonly label = input($localize `theme`);
  readonly group = input.required<UntypedFormGroup>();

  readonly keys = computed(() => {
    this.rootControlState();
    return Object.keys(this.themes()?.value || {});
  });
  readonly selectedTheme = signal<string | undefined>(undefined);

  readonly themes = computed(() => {
    this.rootControlState();
    return this.group().get(this.fieldName()) as UntypedFormGroup | null;
  });

  constructor() {
    // Sync: add the missing themes control to the parent form
    effect(() => {
      const group = this.group();
      const fieldName = this.fieldName();
      if (!group.contains(fieldName)) {
        group.addControl(fieldName, this.fb.group({}));
      }
    });
  }

  addTheme(name: string, value = newTheme()) {
    this.themes()?.addControl(name, this.fb.control(value));
  }

  removeTheme(name: string) {
    this.themes()?.removeControl(name);
  }

  edit(name?: string) {
    this.selectedTheme.set(name);
  }
}

export function themesForm(fb: UntypedFormBuilder, themes: Record<string, string>) {
  return fb.group(mapValues(themes, v => fb.control(v)));
}
