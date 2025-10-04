import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { memo, MemoCache } from '../../../util/memo';
import { access } from '../../../util/tag';

interface TagFormInstance {
  plugin: Plugin;
  tag: string;
  formIndex: number;
  subTag: string;
  formGroup: UntypedFormGroup;
  model: any;
}

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

  instances: TagFormInstance[] = [];
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
      this.updateInstances();
    }
  }

  ngOnInit(): void {
    this.updateInstances();
    this.options.formState.config = this.plugin.defaults;
  }

  private updateInstances() {
    if (!this.tags || !this.plugin) return;

    this.instances = [];
    const allTags = this.tags.value as string[];

    for (const tag of allTags) {
      // Check if this tag starts with the plugin tag
      const cleanTag = tag.replace(/^[_+]/, '');
      const cleanPluginTag = this.plugin.tag.replace(/^[_+]/, '');
      
      if (cleanTag === cleanPluginTag || !cleanTag.startsWith(cleanPluginTag + '/')) {
        continue;
      }
      
      // Extract sub-tags after the plugin tag
      const tagParts = cleanTag.split('/');
      const pluginParts = cleanPluginTag.split('/');
      const subTags = tagParts.slice(pluginParts.length);
      
      // Match sub-tags to tagForm indices
      for (let i = 0; i < subTags.length && this.plugin.config?.tagForm && i < this.plugin.config.tagForm.length; i++) {
        if (this.plugin.config.tagForm[i]) {
          const instance = this.createInstance(tag, i, subTags[i]);
          this.instances.push(instance);
        }
      }
    }
  }

  private createInstance(tag: string, formIndex: number, subTag: string): TagFormInstance {
    const formGroup = this.fb.group({});
    const model = this.createModel(formIndex, subTag);

    // Watch for model changes and emit tag updates
    formGroup.valueChanges.subscribe(() => {
      this.emitTagUpdate(tag, formIndex, model);
    });

    return {
      plugin: this.plugin,
      tag,
      formIndex,
      subTag,
      formGroup,
      model
    };
  }

  private createModel(formIndex: number, subTag: string): any {
    const model: any = {};
    const form = this.getForm(formIndex);

    if (form && form.length > 0) {
      // For each field in the form, extract/parse the value from the sub-tag
      for (const field of form) {
        if (field.key) {
          const key = field.key as string;
          // Convert sub-tag to appropriate format for the field
          // For duration fields, convert lowercase to uppercase (pt15m -> PT15M)
          if (field.type === 'duration') {
            model[key] = subTag.toUpperCase();
          } else {
            model[key] = subTag;
          }
        }
      }
    }

    return model;
  }

  private emitTagUpdate(fullTag: string, formIndex: number, model: any) {
    const form = this.getForm(formIndex);
    if (!form || form.length === 0) return;
    
    // Serialize the model back to a tag string
    let newSubTag = '';
    
    for (const field of form) {
      if (field.key) {
        const key = field.key as string;
        const value = model[key];
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
    const accessPrefix = access(fullTag);
    const pluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const newTag = accessPrefix + pluginTag + '/' + newSubTag;
    
    // Emit tag removal then addition if changed
    if (newTag !== fullTag) {
      this.updateTag.emit(fullTag);  // Remove old tag
      this.updateTag.emit(newTag);    // Add new tag
    }
  }

  getForm(formIndex: number): FormlyFieldConfig[] | undefined {
    return cloneDeep(this.plugin.config?.tagForm?.[formIndex]);
  }

  cssClass(tag: string) {
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-_]/g, '');
  }
}
