import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';

@Component({
  selector: 'app-themes',
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.scss']
})
export class ThemesFormComponent implements OnInit {
  @HostBinding('class') css = 'form-group';

  @Input()
  fieldName = 'themes';
  @Input()
  label = 'theme';

  _group!: UntypedFormGroup;
  keys: string[] = [];
  selectedTheme?: string;

  constructor(
    private fb: UntypedFormBuilder,
  ) { }

  ngOnInit(): void {
  }

  @Input()
  set group(value: UntypedFormGroup) {
    this._group = value;
    this.keys = Object.keys(this.themes.value);
  }

  get themes() {
    if (!this._group.contains(this.fieldName)) {
      this._group.addControl(this.fieldName, this.fb.group({}));
    }
    return this._group.get(this.fieldName) as UntypedFormGroup;
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
  return fb.group(_.mapValues(themes, v => fb.control(v)));
}
