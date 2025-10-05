import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { Plugin } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { expandedTagsInclude } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-form-tag-gen',
  templateUrl: './tag-gen.component.html',
  styleUrls: ['./tag-gen.component.scss']
})
export class TagGenFormComponent implements OnChanges {

  @Input()
  plugin!: Plugin;
  @Input()
  tags!: UntypedFormArray;

  instances: {
    tagIndex: number;
    formGroup: UntypedFormGroup;
    options: FormlyFormOptions;
    model: string[];
    form: FormlyFieldConfig[];
  }[] = [];

  constructor(
    private admin: AdminService,
    private fb: UntypedFormBuilder,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tags || changes.plugin) {
      this.syncFromTags();
    }
  }

  private syncFromTags() {
    this.instances = [];
    if (!this.tags?.value || !this.plugin) return;
    const tags = this.tags.value as string[];
    for (let i = 0; i < tags.length; i++) {
      if (!expandedTagsInclude(tags[i], this.plugin.tag)) continue;
      const form = this.plugin.config!.tagForm!.flatMap(f => (typeof f === 'string') ? [] : f);
      const parts = tags[i].substring(this.plugin.tag.length).split('/').filter(p => p);
      const model = form.map(f => ((parts.shift() ?? f.defaultValue ?? '')).toUpperCase());
      const options = { formState: { admin: this.admin, config: this.plugin.defaults } };
      const formGroup = this.fb.group({});
      formGroup.valueChanges.subscribe(() => this.onFormChange(i));
      this.instances.push({
        tagIndex: i,
        formGroup,
        model,
        form,
        options,
      });
    }
  }

  private onFormChange(instanceIndex: number) {
    const instance = this.instances[instanceIndex];
    const modelCopy = [...instance.model];
    const tagParts = this.plugin.config!.tagForm!.map(f => {
      if (typeof f === 'string') return f;
      return (modelCopy.shift() || '').toLowerCase();
    });
    this.tags.at(instance.tagIndex).setValue(this.plugin.tag + '/' + tagParts.join('/'));
  }
}
