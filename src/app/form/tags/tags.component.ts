import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { add } from 'lodash-es';
import { TAG_REGEX } from '../../util/format';

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

  constructor(
    private fb: UntypedFormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get tags() {
    return this.group.get(this.fieldName) as UntypedFormArray;
  }

  addTag(value = '') {
    this.tags.push(this.fb.control(value, TagsFormComponent.validators));
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }

  setValue(addTags: string[]) {
    while (this.tags.length < addTags.length) {
      this.addTag();
    }
    this.tags.patchValue(addTags);
  }
}

export function tagsForm(fb: UntypedFormBuilder, tags: string[]) {
  return fb.array(tags.map(v => fb.control(v, TagsFormComponent.validators)));
}
