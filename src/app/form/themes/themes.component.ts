import { 
  ChangeDetectionStrategy,
  Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { mapValues } from 'lodash-es';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  selector: 'app-themes',
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.scss'],
  host: {'class': 'form-group'}
})
export class ThemesFormComponent implements OnChanges {

  @Input()
  fieldName = 'themes';
  @Input()
  label = $localize`theme`;
  @Input()
  group!: UntypedFormGroup;

  keys: string[] = [];
  selectedTheme?: string;

  constructor(
    private fb: UntypedFormBuilder,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.group?.currentValue) {
      this.keys = Object.keys(this.themes.value);
    }
  }

  get themes() {
    if (!this.group.contains(this.fieldName)) {
      this.group.addControl(this.fieldName, this.fb.group({}));
    }
    return this.group.get(this.fieldName) as UntypedFormGroup;
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
