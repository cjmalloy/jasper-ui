import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
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
  @Input()
  children: Plugin[] = [];
  @Output()
  togglePlugin = new EventEmitter<string>();

  @ViewChild(FormlyForm)
  formlyForm?: FormlyForm;

  options: FormlyFormOptions = {
  };

  constructor() { }

  get group() {
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup;
  }

  get childrenOn() {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.plugins.contains(this.children[i].tag)) return i + 1;
    }
    return 0;
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
