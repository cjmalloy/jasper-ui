import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { Plugin } from '../../../model/plugin';

@Component({
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss']
})
export class GenFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  plugin!: Plugin;

  @ViewChild(FormlyForm)
  formlyForm?: FormlyForm;

  options: FormlyFormOptions = {
  };

  constructor() { }

  get group() {
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup;
  }

  ngOnInit(): void {
    this.group.patchValue(this.plugin.defaults);
  }

  setValue(value: any) {
    if (!this.formlyForm) return;
    this.formlyForm.model = value[this.plugin.tag];
    // TODO: Why aren't changed being detected?
    // @ts-ignore
    this.formlyForm.builder.build(this.formlyForm.field);
  }
}
