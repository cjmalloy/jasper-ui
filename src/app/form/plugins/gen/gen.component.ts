import { afterNextRender, Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { controlValue } from '../../../util/form';

@Component({
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss'],
  imports: [ReactiveFormsModule, FormlyForm]
})
export class GenFormComponent {
  private admin = inject(AdminService);

  private readonly rootControlState = controlValue(() => this.plugins());


  readonly bulk = input(false);
  readonly promoteAdvanced = input(false);
  readonly plugins = input.required<UntypedFormGroup>();
  readonly plugin = input.required<Plugin>();
  readonly children = input<Plugin[]>([]);
  /**
   * Initial plugin data by tag, used instead of the defaults when a plugin
   * is added. Read when the plugin form is created, which emits pendingUsed.
   */
  readonly pending = input<Record<string, any>>();
  /**
   * Plugin data by tag, such as the plugins of the Ref being edited.
   * The form fields are built from this value.
   */
  readonly values = input<Record<string, any>>();
  readonly pendingUsed = output<string>();
  readonly togglePlugin = output<string>();
  readonly setPlugin = output<{ tag: string, value: any }>();

  readonly model = linkedSignal(() => {
    const tag = this.plugin().tag;
    const value = this.values()?.[tag] ?? this.pending()?.[tag] ?? this.plugin().defaults;
    return value === undefined ? undefined : cloneDeep(value);
  });
  options: FormlyFormOptions = {
    formState: {
      admin: this.admin,
      config: {},
      togglePlugin: (tag: string) => this.togglePlugin.emit(tag),
      setPlugin: (tag: string, value: any) => this.setPlugin.emit({ tag, value }),
    },
  };
  headerModel = {};
  headerOptions: FormlyFormOptions = {
    formState: this.options.formState,
  };

  readonly group = computed(() => {
    this.rootControlState();
    return this.plugins().get(this.plugin().tag) as UntypedFormGroup | undefined;
  });

  readonly form = computed(() => {
    if (this.bulk()) {
      if (this.plugin().config?.bulkForm === true) {
        return cloneDeep(this.plugin().config?.form || this.plugin().config?.advancedForm);
      }
      return cloneDeep(this.plugin().config?.bulkForm) as FormlyFieldConfig[] | undefined;
    }
    const form = this.plugin().config?.form?.filter(f => !isHeader(f));
    return form?.length ? cloneDeep(form) : undefined;
  });

  /**
   * Fields shown in place of the plugin name, such as the child plugin select.
   */
  readonly headerForm = computed(() => {
    if (this.bulk()) return undefined;
    const form = this.plugin().config?.form?.filter(isHeader);
    return form?.length ? cloneDeep(form) : undefined;
  });

  readonly advancedForm = computed(() => {
    if (this.bulk()) return undefined;
    return cloneDeep(this.plugin().config?.advancedForm);
  });

  readonly childrenOn = computed(() => {
    this.rootControlState();
    for (let i = this.children().length - 1; i >= 0; i--) {
      if (this.plugins().contains(this.children()[i].tag)) return i;
    }
    return 0;
  });

  private readonly initialize = afterNextRender(() => {
    const tag = this.plugin().tag;
    if (this.values()?.[tag] === undefined && this.pending()?.[tag] !== undefined) {
      this.pendingUsed.emit(tag);
    }
    this.options.formState.config = this.plugin().defaults;
  });

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

function isHeader(field: FormlyFieldConfig) {
  return field.type === 'child-plugin';
}
