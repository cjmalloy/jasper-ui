import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { memo, MemoCache } from '../../../util/memo';
import { access } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-form-gen',
  templateUrl: './gen.component.html',
  styleUrls: ['./gen.component.scss']
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
  @Input()
  tagFormIndex?: number;
  @Input()
  tagFormSubTag?: string;
  @Input()
  tagFormFullTag?: string;
  @Input()
  group?: UntypedFormGroup;
  @Output()
  togglePlugin = new EventEmitter<string>();

  @ViewChild(FormlyForm)
  formlyForm?: FormlyForm;

  model: any;
  tagFormGroup?: UntypedFormGroup;
  options: FormlyFormOptions = {
    formState: {
      admin: this.admin,
      config: {},
    },
  };

  constructor(
    private admin: AdminService,
    private fb: UntypedFormBuilder,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    MemoCache.clear(this);
    if (changes.tagFormSubTag && this.isTagForm) {
      this.updateTagFormModel();
    }
  }

  get isTagForm() {
    return this.tagFormIndex !== undefined && this.tagFormSubTag !== undefined;
  }

  get pluginGroup() {
    if (this.isTagForm) return undefined;
    return this.plugins.get(this.plugin.tag) as UntypedFormGroup | undefined;
  }

  @memo
  get form() {
    if (this.isTagForm) {
      return cloneDeep(this.plugin.config?.tagForm?.[this.tagFormIndex!]);
    }
    if (this.bulk) {
      if (this.plugin.config?.bulkForm === true) {
        return cloneDeep(this.plugin.config?.form || this.plugin.config?.advancedForm);
      }
      return cloneDeep(this.plugin.config?.bulkForm);
    }
    return cloneDeep(this.plugin.config?.form);
  }

  @memo
  get advancedForm() {
    if (this.bulk || this.isTagForm) return undefined;
    return cloneDeep(this.plugin.config?.advancedForm);
  }

  get childrenOn() {
    if (this.isTagForm) return 0;
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.plugins.contains(this.children[i].tag)) return i;
    }
    return 0;
  }

  ngOnInit(): void {
    if (this.isTagForm) {
      this.tagFormGroup = this.fb.group({});
      this.updateTagFormModel();
      // Watch for model changes and update the tag
      this.tagFormGroup.valueChanges.subscribe(() => {
        this.updateTagFromModel();
      });
    } else {
      this.pluginGroup?.patchValue(this.plugin.defaults);
      this.options.formState.config = this.plugin.defaults;
    }
  }

  updateTagFormModel() {
    if (!this.isTagForm || !this.tagFormSubTag) return;
    
    // Parse the sub-tag value to create the model
    // The sub-tag is in lowercase (e.g., "pt15m")
    // We need to convert it to uppercase for the duration field (e.g., "PT15M")
    this.model = {};
    
    // For now, assume the form has a single field and use its key
    const form = this.form;
    if (form && form.length > 0 && form[0].key) {
      const key = form[0].key as string;
      // Convert lowercase duration to uppercase
      this.model[key] = this.tagFormSubTag.toUpperCase();
    }
  }

  updateTagFromModel() {
    if (!this.isTagForm || !this.group || !this.tagFormFullTag) return;
    
    const tagsArray = this.group.get('tags') as UntypedFormArray;
    if (!tagsArray) return;
    
    // Get the new value from the model
    const form = this.form;
    if (!form || form.length === 0 || !form[0].key) return;
    
    const key = form[0].key as string;
    const newValue = this.model[key];
    if (!newValue) return;
    
    // Convert the value to lowercase for the tag
    const newSubTag = (newValue as string).toLowerCase();
    
    // Build the new tag
    const accessPrefix = access(this.tagFormFullTag);
    const pluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const newTag = accessPrefix + pluginTag + '/' + newSubTag;
    
    // Find and update the tag in the array
    const tags = tagsArray.value as string[];
    const index = tags.indexOf(this.tagFormFullTag);
    if (index !== -1 && tags[index] !== newTag) {
      tagsArray.at(index).setValue(newTag);
    }
  }

  setValue(value: any) {
    if (this.isTagForm) {
      // For tagForm, we don't use setValue from external sources
      return;
    }
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
