import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-template-form',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss']
})
export class TemplateFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;

  constructor() { }

  ngOnInit(): void {
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  get name() {
    return this.group.get('name') as UntypedFormControl;
  }

}

export function templateForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: ['', []],
    name: ['', [Validators.required]],
    config: [],
    defaults: [],
    schema: [],
  });
}
