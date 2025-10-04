import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { access } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-form-tag-gen',
  templateUrl: './tag-gen.component.html',
  styleUrls: ['./tag-gen.component.scss']
})
export class TagGenFormComponent implements OnChanges {

  @Input() plugin!: Plugin;
  @Input() tags!: UntypedFormArray;

  instances: {
    tagIndex: number;
    formGroup: UntypedFormGroup;
    model: any[];
    form: FormlyFieldConfig[];
    options: FormlyFormOptions;
    updating: boolean;
  }[] = [];

  constructor(
    private admin: AdminService,
    private fb: UntypedFormBuilder,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tags || changes.plugin) {
      this.syncFromTags();
    }
  }

  private syncFromTags() {
    if (!this.tags?.value || !this.plugin) return;

    const pluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const tags = this.tags.value as string[];

    // Support multiple tags - create instance for each matching tag
    this.instances = [];
    
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i].replace(/^[_+]/, '');
      
      if (tag === pluginTag || tag.startsWith(pluginTag + '/')) {
        const form = this.plugin.config?.tagForm?.[0];
        if (!form?.length) continue;
        
        const subTags = tag === pluginTag ? [] : tag.split('/').slice(pluginTag.split('/').length);
        
        // Create model for this instance
        const parts = subTags.slice();
        const model = form.flatMap(f => {
          const t = parts.shift();
          if (typeof f === 'string') return [];
          const value = t ?? (f.defaultValue ?? this.plugin.defaults?.[f.key as string]);
          return [f.type === 'duration' ? value?.toUpperCase() : value];
        });
        
        const formGroup = this.fb.group({});
        const options = { formState: { admin: this.admin, config: this.plugin.defaults } };
        
        // Subscribe to changes for this instance
        formGroup.valueChanges.subscribe(() => this.onFormChange(i));
        
        this.instances.push({
          tagIndex: i,
          formGroup,
          model,
          form,
          options,
          updating: false
        });
      }
    }
  }

  private onFormChange(instanceIndex: number) {
    const instance = this.instances[instanceIndex];
    if (instance.updating || !instance.form?.length) return;

    const modelCopy = [...instance.model];
    const tagParts = instance.form.flatMap(f => {
      if (typeof f === 'string') return [f];
      const value = modelCopy.shift();
      if (!value) return [];
      return [f.type === 'duration' ? value.toLowerCase() : value];
    });

    if (tagParts.length === 0) return;

    const currentTag = this.tags.at(instance.tagIndex).value;
    const newTag = access(currentTag) + this.plugin.tag.replace(/^[_+]/, '') + '/' + tagParts.join('/');

    if (newTag !== currentTag) {
      this.tags.at(instance.tagIndex).setValue(newTag);
    }
  }
}
