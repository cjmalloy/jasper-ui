import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';

@Component({
  standalone: false,
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss']
})
export class GenFormComponent implements OnInit {

  @Input()
  bulk = false;
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
      admin: this.admin,
      config: {},
    },
  };

  constructor(
    private admin: AdminService,
  ) { }

  get group() {
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup | undefined;
  }

  get form() {
    if (this.bulk) {
      if (this.plugin.config?.bulkForm === true) {
        return this.plugin.config?.form || this.plugin.config?.advancedForm;
      }
      return this.plugin.config?.bulkForm;
    }
    return this.plugin.config?.form;
  }

  get advancedForm() {
    if (this.bulk) return undefined;
    return this.plugin.config?.advancedForm;
  }

  get childrenOn() {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.plugins.contains(this.children[i].tag)) return i;
    }
    return 0;
  }

  ngOnInit(): void {
    this.group?.patchValue(this.plugin.defaults);
    this.options.formState.config = this.plugin.defaults;
  }

  setValue(value: any) {
    this.model = value[this.plugin.tag];
  }

  cssClass(tag: string) {
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-_]/g, '');
  }

  toggleChild(tag: string) {
    this.togglePlugin.next(tag);
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
  }
}
