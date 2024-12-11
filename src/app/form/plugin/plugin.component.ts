import { Component, HostBinding, Input } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';

@Component({
  standalone: false,
  selector: 'app-plugin-form',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss']
})
export class PluginFormComponent {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  configErrors: string[] = [];
  @Input()
  defaultsErrors: string[] = [];
  @Input()
  schemaErrors: string[] = [];

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
    tag: [{value: '', disabled: true}, [Validators.required]],
    name: ['', [Validators.required]],
    generateMetadata: [false],
    config: [],
    defaults: [],
    schema: [],
  });
}
