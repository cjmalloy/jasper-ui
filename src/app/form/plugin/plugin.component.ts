import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-plugin-form',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss']
})
export class PluginFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  configErrors: string[] = [];
  @Input()
  defaultsErrors: string[] = [];
  @Input()
  schemaErrors: string[] = [];

  constructor() { }

  ngOnInit(): void {
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  get name() {
    return this.group.get('name') as UntypedFormControl;
  }

  validate(input: HTMLInputElement) {
    if (this.name.touched) {
      if (this.name.errors?.['required']) {
        input.setCustomValidity($localize`Name must not be blank.`);
        input.reportValidity();
      }
    }
  }

}

export function pluginForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: ['', [Validators.required]],
    name: ['', [Validators.required]],
    generateMetadata: [false],
    config: [],
    defaults: [],
    schema: [],
  });
}
