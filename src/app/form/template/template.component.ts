import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Template } from '../../model/template';
import { JsonComponent } from '../json/json.component';

@Component({
  selector: 'app-template-form',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss']
})
export class TemplateFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;

  @ViewChild('configJson')
  configJson?: JsonComponent;
  @ViewChild('defaultsJson')
  defaultsJson?: JsonComponent;
  @ViewChild('schemaJson')
  schemaJson?: JsonComponent;

  constructor() { }

  ngOnInit(): void {
  }

  get tag() {
    return this.group.get('tag') as UntypedFormControl;
  }

  get name() {
    return this.group.get('name') as UntypedFormControl;
  }

  get config() {
    return this.group.get('config') as UntypedFormGroup;
  }

  get defaults() {
    return this.group.get('defaults') as UntypedFormGroup;
  }

  get configForm() {
    return this.config.value?.configForm;
  }

  get form() {
    return [
      ...(this.config.value?.form || []),
      ...(this.config.value?.advancedForm || [])
    ];
  }

  setValue(model: Template) {
    this.group.patchValue({
      tag: model.tag,
      name: model.name,
    });
    this.configJson?.setValue(model.config);
    this.defaultsJson?.setValue(model.defaults);
    this.schemaJson?.setValue(model.schema);
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
