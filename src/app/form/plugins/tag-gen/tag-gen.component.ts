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
    const cleanPluginTag = this.plugin.tag.replace(/^[_+]/, '');

    // Find the first tag that matches this plugin
    for (const tag of allTags) {
      const cleanTag = tag.replace(/^[_+]/, '');
      
      // Check if this is the base plugin tag
      if (cleanTag === cleanPluginTag) {
        // Show form for adding a sub-tag
        this.currentTag = tag;
        this.subTag = undefined;
        this.createFormInstance();
        return;
      }
      
      // Check if this tag starts with the plugin tag
      if (cleanTag.startsWith(cleanPluginTag + '/')) {
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

    if (!form || form.length === 0) return model;

    // For each field in the form, extract/parse the value from the sub-tag or use defaults
    for (const field of form) {
      if (field.key) {
        const key = field.key as string;
        if (this.subTag) {
          // Convert sub-tag to appropriate format for the field
          // For duration fields, convert lowercase to uppercase (pt15m -> PT15M)
          if (field.type === 'duration') {
            model[key] = this.subTag.toUpperCase();
          } else {
            model[key] = this.subTag;
          }
        } else {
          // Use default value if no sub-tag exists
          if (field.defaultValue !== undefined) {
            model[key] = field.defaultValue;
          } else if (this.plugin.defaults?.[key] !== undefined) {
            model[key] = this.plugin.defaults[key];
          }
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
    
    // Check if we're adding a sub-tag to the base tag
    const cleanCurrentTag = this.currentTag.replace(/^[_+]/, '');
    const cleanPluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const isBaseTag = cleanCurrentTag === cleanPluginTag;
    
    // Emit tag updates
    if (newTag !== this.currentTag) {
      if (!isBaseTag) {
        // Editing existing tag with sub-tag: remove old, add new
        this.updateTag.emit(this.currentTag);  // Remove old tag
      }
      this.updateTag.emit(newTag);              // Add new tag
      this.currentTag = newTag;                 // Update current tag reference
      this.subTag = newSubTag;                  // Update sub-tag reference
      
      // If we were on the base tag, also remove it after adding the new tag
      if (isBaseTag) {
        this.updateTag.emit(accessPrefix + pluginTag);  // Remove base tag
      }
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
