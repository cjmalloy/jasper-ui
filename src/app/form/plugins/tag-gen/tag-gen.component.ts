import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { memo, MemoCache } from '../../../util/memo';
import { access } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-form-tag-gen',
  templateUrl: './tag-gen.component.html',
  styleUrls: ['./tag-gen.component.scss']
})
export class TagGenFormComponent implements OnInit, OnChanges {

  @Input()
  plugin!: Plugin;
  @Input()
  tags!: UntypedFormArray;
  @Output()
  updateTag = new EventEmitter<string>();

  formGroup?: UntypedFormGroup;
  model: any = {};
  currentTag?: string;
  subTag?: string;
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
    if (changes.tags || changes.plugin) {
      this.updateInstance();
    }
  }

  ngOnInit(): void {
    this.updateInstance();
    this.options.formState.config = this.plugin.defaults;
  }

  private updateInstance() {
    if (!this.tags || !this.plugin) return;

    const allTags = this.tags.value as string[];

    // Find the first tag that matches this plugin
    for (const tag of allTags) {
      const cleanTag = tag.replace(/^[_+]/, '');
      const cleanPluginTag = this.plugin.tag.replace(/^[_+]/, '');
      
      if (cleanTag === cleanPluginTag || !cleanTag.startsWith(cleanPluginTag + '/')) {
        continue;
      }
      
      // Extract sub-tags after the plugin tag
      const tagParts = cleanTag.split('/');
      const pluginParts = cleanPluginTag.split('/');
      const subTags = tagParts.slice(pluginParts.length);
      
      // Use the first sub-tag if it exists
      if (subTags.length > 0 && this.plugin.config?.tagForm?.[0]) {
        this.currentTag = tag;
        this.subTag = subTags[0];
        this.createFormInstance();
        return;
      }
    }
    
    // No matching tag found - clear the form
    this.currentTag = undefined;
    this.subTag = undefined;
    this.formGroup = undefined;
    this.model = {};
  }

  private createFormInstance() {
    if (!this.formGroup) {
      this.formGroup = this.fb.group({});
      // Watch for model changes and emit tag updates
      this.formGroup.valueChanges.subscribe(() => {
        this.emitTagUpdate();
      });
    }
    
    this.model = this.createModel();
  }

  private createModel(): any {
    const model: any = {};
    const form = this.form;

    if (!form || form.length === 0 || !this.subTag) return model;

    // For each field in the form, extract/parse the value from the sub-tag
    for (const field of form) {
      if (field.key) {
        const key = field.key as string;
        // Convert sub-tag to appropriate format for the field
        // For duration fields, convert lowercase to uppercase (pt15m -> PT15M)
        if (field.type === 'duration') {
          model[key] = this.subTag.toUpperCase();
        } else {
          model[key] = this.subTag;
        }
      }
    }

    return model;
  }

  private emitTagUpdate() {
    if (!this.currentTag) return;
    
    const form = this.form;
    if (!form || form.length === 0) return;
    
    // Serialize the model back to a tag string
    let newSubTag = '';
    
    for (const field of form) {
      if (field.key) {
        const key = field.key as string;
        const value = this.model[key];
        if (value) {
          // Convert value to string format for tag
          // For duration fields, convert uppercase to lowercase (PT15M -> pt15m)
          if (field.type === 'duration') {
            newSubTag = (value as string).toLowerCase();
          } else {
            newSubTag = value as string;
          }
        }
      }
    }
    
    if (!newSubTag) return;
    
    // Build the new tag
    const accessPrefix = access(this.currentTag);
    const pluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const newTag = accessPrefix + pluginTag + '/' + newSubTag;
    
    // Emit tag removal then addition if changed
    if (newTag !== this.currentTag) {
      this.updateTag.emit(this.currentTag);  // Remove old tag
      this.updateTag.emit(newTag);            // Add new tag
      this.currentTag = newTag;               // Update current tag reference
    }
  }

  @memo
  get form(): FormlyFieldConfig[] | undefined {
    return cloneDeep(this.plugin.config?.tagForm?.[0]);
  }

  cssClass(tag: string) {
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-_]/g, '');
  }
}
