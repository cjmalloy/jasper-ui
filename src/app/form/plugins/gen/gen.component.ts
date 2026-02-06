import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  input,
  OnChanges,
  OnInit,
  output,
  SimpleChanges
} from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { memo, MemoCache } from '../../../util/memo';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss'],
  imports: [ReactiveFormsModule, FormlyForm]
})
export class GenFormComponent implements OnInit, OnChanges {
  private admin = inject(AdminService);


  readonly bulk = input(false);
  readonly promoteAdvanced = input(false);
  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  plugin!: Plugin;
  readonly children = input<Plugin[]>([]);
  readonly togglePlugin = output<string>();

  model: any;
  options: FormlyFormOptions = {
    formState: {
      admin: this.admin,
      config: {},
    },
  };

  ngOnChanges(changes: SimpleChanges) {
    MemoCache.clear(this);
  }

  get group() {
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup | undefined;
  }

  @memo
  get form() {
    if (this.bulk()) {
      if (this.plugin.config?.bulkForm === true) {
        return cloneDeep(this.plugin.config?.form || this.plugin.config?.advancedForm);
      }
      return cloneDeep(this.plugin.config?.bulkForm);
    }
    return cloneDeep(this.plugin.config?.form);
  }

  @memo
  get advancedForm() {
    if (this.bulk()) return undefined;
    return cloneDeep(this.plugin.config?.advancedForm);
  }

  get childrenOn() {
    for (let i = this.children().length - 1; i >= 0; i--) {
      if (this.plugins.contains(this.children()[i].tag)) return i;
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
    this.togglePlugin.emit(tag);
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
  }
}
