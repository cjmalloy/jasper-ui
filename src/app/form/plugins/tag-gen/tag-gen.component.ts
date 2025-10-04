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

  formGroup = this.fb.group({});
  model: any[] = [];
  form?: FormlyFieldConfig[];
  options: FormlyFormOptions;

  private tagIndex?: number;
  private updating = false;

  constructor(
    private admin: AdminService,
    private fb: UntypedFormBuilder,
  ) {
    this.options = { formState: { admin, config: {} } };
    this.formGroup.valueChanges.subscribe(() => this.onFormChange());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tags || changes.plugin) {
      this.syncFromTags();
    }
  }

  private syncFromTags() {
    if (!this.tags?.value || !this.plugin) return;

    const pluginTag = this.plugin.tag.replace(/^[_+]/, '');
    const tags = this.tags.value as string[];

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i].replace(/^[_+]/, '');
      
      if (tag === pluginTag || tag.startsWith(pluginTag + '/')) {
        this.tagIndex = i;
        this.form = this.plugin.config?.tagForm?.[0];
        this.options.formState.config = this.plugin.defaults;
        
        const subTags = tag === pluginTag ? [] : tag.split('/').slice(pluginTag.split('/').length);
        this.updating = true;
        this.model = this.createModel(subTags);
        this.updating = false;
        return;
      }
    }

    this.tagIndex = undefined;
    this.form = undefined;
    this.model = [];
  }

  private createModel(subTags: string[]): any[] {
    if (!this.form?.length) return [];

    const model: any[] = [];
    
    for (let i = 0; i < this.form.length; i++) {
      const field = this.form[i];
      
      if (i < subTags.length) {
        const value = subTags[i];
        model[i] = field.type === 'duration' ? value.toUpperCase() : value;
      } else {
        model[i] = field.defaultValue ?? this.plugin.defaults?.[field.key as string];
      }
    }
    return model;
  }

  private onFormChange() {
    if (this.updating || this.tagIndex === undefined || !this.form?.length) return;

    const tagParts: string[] = [];
    for (let i = 0; i < this.form.length; i++) {
      const field = this.form[i];
      const value = this.model[i];
      if (!value) return;
      
      tagParts.push(field.type === 'duration' ? value.toLowerCase() : value);
    }

    const currentTag = this.tags.at(this.tagIndex).value;
    const newTag = access(currentTag) + this.plugin.tag.replace(/^[_+]/, '') + '/' + tagParts.join('/');

    if (newTag !== currentTag) {
      this.tags.at(this.tagIndex).setValue(newTag);
    }
  }
}
