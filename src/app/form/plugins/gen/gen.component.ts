import { AfterViewInit, Component, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { Plugin } from '../../../model/plugin';

@Component({
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss']
})
export class GenFormComponent implements AfterViewInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  plugin!: Plugin;

  forms: FormlyFieldConfig[] = [];

  options: FormlyFormOptions = {
  };

  constructor() { }

  get miniForm() {
    return this.plugin.config?.form?.length === 1 && !this.plugin.config!.form![0].props?.label;
  }

  get singleForm() {
    return this.plugin.config?.form?.length === 1 && !this.plugin.config.form[0]!.key;
  }

  get group() {
    if (this.singleForm) {
      return this.plugins;
    } else {
      return this.plugins.get(this.plugin.tag) as UntypedFormGroup;
    }
  }

  ngAfterViewInit(): void {
    if (this.singleForm) {
      this.forms = [{
        ...this.plugin.config!.form![0]!,
        key: this.plugin.tag,
      }];
      this.plugins.patchValue({
        [this.plugin.tag]: this.plugin.defaults
      });
    } else {
      this.forms = this.plugin.config!.form!;
      this.group.patchValue(this.plugin.defaults);
    }
  }

}
