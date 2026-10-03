import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { memo, MemoCache } from '../../../util/memo';

@Component({
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, FormlyForm]
})
export class GenFormComponent implements OnInit, OnChanges {

  @Input()
  bulk = false;
  @Input()
  promoteAdvanced = false;
  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  plugin!: Plugin;
  @Input()
  children: Plugin[] = [];
  /**
   * Initial plugin data by tag, used instead of the defaults when a plugin
   * is added. Read when the plugin form is created, which emits pendingUsed.
   */
  @Input()
  pending?: Record<string, any>;
  @Output()
  pendingUsed = new EventEmitter<string>();
  @Output()
  togglePlugin = new EventEmitter<string>();
  @Output()
  setPlugin = new EventEmitter<{ tag: string, value: any }>();

  model: any;
  options: FormlyFormOptions = {
    formState: {
      admin: this.admin,
      config: {},
      togglePlugin: (tag: string) => this.togglePlugin.next(tag),
      setPlugin: (tag: string, value: any) => this.setPlugin.next({ tag, value }),
    },
  };
  headerModel = {};
  headerOptions: FormlyFormOptions = {
    formState: this.options.formState,
  };

  constructor(
    private admin: AdminService,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    MemoCache.clear(this);
  }

  get group() {
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup | undefined;
  }

  @memo
  get form() {
    if (this.bulk) {
      if (this.plugin.config?.bulkForm === true) {
        return cloneDeep(this.plugin.config?.form || this.plugin.config?.advancedForm);
      }
      return cloneDeep(this.plugin.config?.bulkForm);
    }
    const form = this.plugin.config?.form?.filter(f => !isHeader(f));
    return form?.length ? cloneDeep(form) : undefined;
  }

  /**
   * Fields shown in place of the plugin name, such as the child plugin select.
   */
  @memo
  get headerForm() {
    if (this.bulk) return undefined;
    const form = this.plugin.config?.form?.filter(isHeader);
    return form?.length ? cloneDeep(form) : undefined;
  }

  @memo
  get advancedForm() {
    if (this.bulk) return undefined;
    return cloneDeep(this.plugin.config?.advancedForm);
  }

  get childrenOn() {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.plugins.contains(this.children[i].tag)) return i;
    }
    return 0;
  }

  ngOnInit(): void {
    const pending = this.pending?.[this.plugin.tag];
    if (pending) {
      this.model = cloneDeep(pending);
      this.pendingUsed.next(this.plugin.tag);
    } else {
      this.group?.patchValue(this.plugin.defaults);
    }
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

function isHeader(field: FormlyFieldConfig) {
  return field.type === 'child-plugin';
}
