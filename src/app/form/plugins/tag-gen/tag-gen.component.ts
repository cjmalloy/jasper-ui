import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
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

  formGroup?: UntypedFormGroup;
  model: any = {};
  private currentTagIndex?: number;
  private subTag?: string;
  private updatingFromTag = false;
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
    for (let i = 0; i < allTags.length; i++) {
      const tag = allTags[i];
      const cleanTag = tag.replace(/^[_+]/, '');
      
      // Check if this is the base plugin tag or a tag with sub-tag
      if (cleanTag === cleanPluginTag) {
        this.currentTagIndex = i;
        this.subTag = undefined;
        this.createFormInstance();
        return;
      }
      
      if (cleanTag.startsWith(cleanPluginTag + '/')) {
        const tagParts = cleanTag.split('/');
        const pluginParts = cleanPluginTag.split('/');
        const subTags = tagParts.slice(pluginParts.length);
        
        if (subTags.length > 0 && this.plugin.config?.tagForm?.[0]) {
          this.currentTagIndex = i;
          this.subTag = subTags[0];
          this.createFormInstance();
          return;
        }
      }
    }
    
    // No matching tag found - clear the form
    this.currentTagIndex = undefined;
    this.subTag = undefined;
    this.formGroup = undefined;
    this.model = {};
  }

  private createFormInstance() {
    if (!this.formGroup) {
      this.formGroup = this.fb.group({});
      this.formGroup.valueChanges.subscribe(() => {
        this.updateTag();
      });
    }
    
    this.updatingFromTag = true;
    this.model = this.createModel();
    this.updatingFromTag = false;
  }

  private createModel(): any {
    const model: any = {};
    const form = this.form;

    if (!form || form.length === 0) return model;

    for (const field of form) {
      if (field.key) {
        const key = field.key as string;
        if (this.subTag) {
          if (field.type === 'duration') {
            model[key] = this.subTag.toUpperCase();
          } else {
            model[key] = this.subTag;
          }
        } else {
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

  private updateTag() {
    if (this.updatingFromTag || this.currentTagIndex === undefined) return;
    
    const form = this.form;
    if (!form || form.length === 0) return;
    
    let newSubTag = '';
    for (const field of form) {
      if (field.key) {
        const value = this.model[field.key as string];
        if (value) {
          if (field.type === 'duration') {
            newSubTag = (value as string).toLowerCase();
          } else {
            newSubTag = value as string;
          }
        }
      }
    }
    
    if (!newSubTag) return;
    
    const currentTag = this.tags.at(this.currentTagIndex).value;
    const accessPrefix = access(currentTag);
    const pluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const newTag = accessPrefix + pluginTag + '/' + newSubTag;
    
    if (newTag !== currentTag) {
      this.tags.at(this.currentTagIndex).setValue(newTag);
      this.subTag = newSubTag;
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
