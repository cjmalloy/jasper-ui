import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Plugin } from '../../model/plugin';
import { JsonComponent } from '../json/json.component';

@Component({
  selector: 'app-plugin-form',
  templateUrl: './plugin.component.html',
  styleUrls: ['./plugin.component.scss']
})
export class PluginFormComponent implements OnInit {
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
      ...(this.config.value?.advancedForm || []),
    ];
  }

  setValue(model: Plugin) {
    this.group.patchValue({
      tag: model.tag,
      name: model.name,
    });
    this.configJson?.setValue(model.config);
    this.defaultsJson?.setValue(model.defaults);
    this.schemaJson?.setValue(model.schema);
  }

}

export function pluginForm(fb: UntypedFormBuilder) {
  return fb.group({
    tag: ['', [Validators.required]],
    name: ['', [Validators.required]],
    generateMetadata: [false],
    config: [fb.group({})],
    defaults: [fb.group({})],
    schema: [fb.group({})],
  });
}
