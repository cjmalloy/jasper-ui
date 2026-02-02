import { ChangeDetectionStrategy, Component, inject, input, OnChanges, SimpleChanges } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { mapValues } from 'lodash-es';
import { ListEditorComponent } from '../../component/list-editor/list-editor.component';
import { CodeComponent } from '../code/code.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-themes',
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.scss'],
  host: { 'class': 'form-group' },
  imports: [ListEditorComponent, CodeComponent]
})
export class ThemesFormComponent implements OnChanges {
  private fb = inject(UntypedFormBuilder);


  readonly fieldName = input('themes');
  readonly label = input($localize `theme`);
  readonly group = input.required<UntypedFormGroup>();

  keys: string[] = [];
  selectedTheme?: string;

  ngOnChanges(changes: SimpleChanges) {
    if (changes.group?.currentValue) {
      this.keys = Object.keys(this.themes.value);
    }
  }

  get themes() {
    const group = this.group();
    const fieldName = this.fieldName();
    if (!group.contains(fieldName)) {
      group.addControl(fieldName, this.fb.group({}));
    }
    return group.get(fieldName) as UntypedFormGroup;
  }

  addTheme(name: string, value = '') {
    this.themes.addControl(name, this.fb.control(value));
  }

  removeTheme(name: string) {
    this.themes.removeControl(name);
  }

  edit(name?: string) {
    this.selectedTheme = name;
  }
}

export function themesForm(fb: UntypedFormBuilder, themes: Record<string, string>) {
  return fb.group(mapValues(themes, v => fb.control(v)));
}
