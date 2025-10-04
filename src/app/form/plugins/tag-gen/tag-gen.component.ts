import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
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
  formIndex!: number;
  @Input()
  subTag!: string;
  @Input()
  fullTag!: string;
  @Output()
  updateTag = new EventEmitter<{ oldTag: string, newTag: string }>();

  tagFormGroup!: UntypedFormGroup;
  model: any = {};
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
    if (changes.subTag || changes.formIndex) {
      this.updateModel();
    }
  }

  @memo
  get form(): FormlyFieldConfig[] | undefined {
    return cloneDeep(this.plugin.config?.tagForm?.[this.formIndex]);
  }

  ngOnInit(): void {
    this.tagFormGroup = this.fb.group({});
    this.updateModel();
    this.options.formState.config = this.plugin.defaults;
    
    // Watch for model changes and emit tag updates
    this.tagFormGroup.valueChanges.subscribe(() => {
      this.emitTagUpdate();
    });
  }

  private updateModel() {
    if (!this.subTag) return;
    
    // Parse the sub-tag value to create the model
    // The form controls will be serialized back to the tag
    this.model = {};
    
    const form = this.form;
    if (form && form.length > 0) {
      // For each field in the form, extract/parse the value from the sub-tag
      for (const field of form) {
        if (field.key) {
          const key = field.key as string;
          // Convert sub-tag to appropriate format for the field
          // For duration fields, convert lowercase to uppercase (pt15m -> PT15M)
          if (field.type === 'duration') {
            this.model[key] = this.subTag.toUpperCase();
          } else {
            this.model[key] = this.subTag;
          }
        }
      }
    }
  }

  private emitTagUpdate() {
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
    const accessPrefix = access(this.fullTag);
    const pluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const newTag = accessPrefix + pluginTag + '/' + newSubTag;
    
    // Emit the tag update if it changed
    if (newTag !== this.fullTag) {
      this.updateTag.emit({ oldTag: this.fullTag, newTag });
    }
  }

  cssClass(tag: string) {
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-_]/g, '');
  }
}
