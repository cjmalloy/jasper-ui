import { Component, forwardRef, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { TAG_REGEX } from '../../util/format';

@Component({
  selector: 'app-tags',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss'],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagsComponent), multi: true}]
})
export class TagsComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(TAG_REGEX)];

  @Input()
  group!: FormGroup;
  @Input()
  fieldName = 'tags';

  constructor(
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get tags() {
    return this.group.get(this.fieldName) as FormArray;
  }

  addTag(value = '') {
    this.tags.push(this.fb.control(value, TagsComponent.validators));
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }
}

export function tagsForm(fb: FormBuilder, tags: string[]) {
  return fb.array(tags.map(v => fb.control(v, TagsComponent.validators)));
}
