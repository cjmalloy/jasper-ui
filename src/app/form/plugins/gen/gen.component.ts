import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { Plugin } from '../../../model/plugin';
import { defer } from 'lodash-es';

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

  model: any;
  options: FormlyFormOptions = {
    formState: {
      config: {},
    },
  };

  constructor() { }

  get group() {
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup;
  }

  get childrenOn() {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.plugins.contains(this.children[i].tag)) return i;
    }
    return 0;
  }

  ngOnInit(): void {
    this.group.patchValue(this.plugin.defaults);
    this.options.formState.config = this.plugin.defaults;
  }

  setValue(value: any) {
    this.model = value[this.plugin.tag];
  }

  cssClass(tag: string) {
    return tag.replace(/\//g, '-')
      .replace(/[^\w-]/g, '');
  }

  toggleChild(tag: string) {
    this.togglePlugin.next(tag);
    if ('vibrate' in navigator) defer(() => navigator.vibrate([32]));
  }
}
