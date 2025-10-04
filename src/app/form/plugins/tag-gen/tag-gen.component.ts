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

    // Support multiple tags - find first matching tag
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i].replace(/^[_+]/, '');
      
      if (tag === pluginTag || tag.startsWith(pluginTag + '/')) {
        this.tagIndex = i;
        this.form = this.plugin.config?.tagForm?.[0];
        this.options.formState.config = this.plugin.defaults;
        
        const subTags = tag === pluginTag ? [] : tag.split('/').slice(pluginTag.split('/').length);
        this.updating = true;
        
        // Inline createModel logic
        if (!this.form?.length) {
          this.model = [];
        } else {
          const parts = subTags.slice();
          this.model = this.form.flatMap(f => {
            const t = parts.shift();
            if (typeof f === 'string') return [];
            const value = t ?? (f.defaultValue ?? this.plugin.defaults?.[f.key as string]);
            return [f.type === 'duration' ? value?.toUpperCase() : value];
          });
        }
        
        this.updating = false;
        return;
      }
    }

    this.tagIndex = undefined;
    this.form = undefined;
    this.model = [];
  }

  private onFormChange() {
    if (this.updating || this.tagIndex === undefined || !this.form?.length) return;

    const modelCopy = [...this.model];
    const tagParts = this.form.flatMap(f => {
      if (typeof f === 'string') return [f];
      const value = modelCopy.shift();
      if (!value) return [];
      return [f.type === 'duration' ? value.toLowerCase() : value];
    });

    if (tagParts.length === 0) return;

    const currentTag = this.tags.at(this.tagIndex).value;
    const newTag = access(currentTag) + this.plugin.tag.replace(/^[_+]/, '') + '/' + tagParts.join('/');

    if (newTag !== currentTag) {
      this.tags.at(this.tagIndex).setValue(newTag);
    }
  }
}
