import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { FormlyFormOptions } from '@ngx-formly/core';
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

  options: FormlyFormOptions = {
  };

  constructor() { }

  get group() {
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup;
  }

  ngOnInit(): void {
    this.group.patchValue(this.plugin.defaults);
  }

}
