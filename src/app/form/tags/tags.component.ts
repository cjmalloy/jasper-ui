import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { map } from 'lodash-es';
import { TAG_REGEX } from '../../util/format';
import { includesTag } from '../../util/tag';

@Component({
  selector: 'app-tags',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsFormComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(TAG_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'tags';
  @Input()
  emoji = '🏷️';

  autofocus = -1;

  constructor(
    private fb: UntypedFormBuilder,
  ) { }

  ngOnInit(): void {
  }

  get tags() {
    return this.group.get(this.fieldName) as UntypedFormArray;
  }

  addTag(...values: string[]) {
    if (!values.length) return;
    this.autofocus = values[0] ? -1 : this.tags.length;
    for (const value of values) {
      if (value && value !== 'placeholder' && this.tags.value.includes(value)) return;
      this.tags.push(this.fb.control(value, TagsFormComponent.validators));
    }
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }

  setValue(addTags: string[]) {
    while (this.tags.length < addTags.length) this.addTag(addTags[this.tags.length]);
  }

  includesTag(tag: string) {
    return includesTag(tag, this.tags.value || []);
  }

  removeTagOrSuffix(tag: string) {
    let removed = false;
    const tags = this.tags.value || [];
    for (let i = tags.length - 1; i >= 0; i--) {
      if (tag === tags[i] || tags[i].startsWith(tag + '/')) {
        this.removeTag(i);
        removed = true;
      }
    }
    if (removed && tag.includes('/')) {
      const parent = tag.substring(0, tag.lastIndexOf('/'));
      if (!tags.includes(parent)) this.addTag(parent);
    }
  }
}

export function tagsForm(fb: UntypedFormBuilder, tags: string[]) {
  return fb.array(map(tags, v => fb.control(v, TagsFormComponent.validators)));
}
