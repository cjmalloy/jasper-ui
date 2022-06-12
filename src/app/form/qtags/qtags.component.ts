import { Component, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { QUALIFIED_TAG_REGEX, TAG_REGEX } from '../../util/format';

@Component({
  selector: 'app-qtags',
  templateUrl: './qtags.component.html',
  styleUrls: ['./qtags.component.scss']
})
export class QtagsComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(QUALIFIED_TAG_REGEX)];

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
    this.tags.push(this.fb.control(value, QtagsComponent.validators));
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }
}

export function qtagsForm(fb: FormBuilder, tags: string[]) {
  return fb.array(tags.map(v => fb.control(v, QtagsComponent.validators)));
}
