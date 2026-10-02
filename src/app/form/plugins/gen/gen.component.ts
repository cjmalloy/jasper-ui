import { Component, OnInit, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';

@Component({
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormlyForm]
})
export class GenFormComponent implements OnInit {

  readonly bulk = input(false);
  readonly promoteAdvanced = input(false);
  readonly plugins = input.required<UntypedFormGroup>();
  readonly plugin = input.required<Plugin>();
  readonly children = input<Plugin[]>([]);
  readonly togglePlugin = output<string>();

  readonly model = signal<any>(undefined);
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
    return this.plugins().get(this.plugin().tag) as UntypedFormGroup | undefined;
  }

  readonly form = computed(() => {
    if (this.bulk()) {
      if (this.plugin().config?.bulkForm === true) {
        return cloneDeep(this.plugin().config?.form || this.plugin().config?.advancedForm);
      }
      return cloneDeep(this.plugin().config?.bulkForm) as FormlyFieldConfig[] | undefined;
    }
    return cloneDeep(this.plugin().config?.form);
  });

  readonly advancedForm = computed(() => {
    if (this.bulk()) return undefined;
    return cloneDeep(this.plugin().config?.advancedForm);
  });

  get childrenOn() {
    for (let i = this.children().length - 1; i >= 0; i--) {
      if (this.plugins().contains(this.children()[i].tag)) return i;
    }
    return 0;
  }

  ngOnInit(): void {
    this.group?.patchValue(this.plugin().defaults);
    this.options.formState.config = this.plugin().defaults;
  }

  setValue(value: any) {
    this.model.set(value[this.plugin().tag]);
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
