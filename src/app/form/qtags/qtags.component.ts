import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { map } from 'lodash-es';
import { QUALIFIED_TAG_REGEX } from '../../util/format';

@Component({
  selector: 'app-qtags',
  templateUrl: './qtags.component.html',
  styleUrls: ['./qtags.component.scss']
})
export class QtagsFormComponent implements OnInit {
  static validators = [Validators.pattern(QUALIFIED_TAG_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'tags';
  @Input()
  label = $localize`tag`;

  autofocus = -1;

  constructor(
    private fb: UntypedFormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get tags() {
    return this.group.get(this.fieldName) as UntypedFormArray;
  }

  addTag(value = '') {
    if (value && this.tags.value.includes(value)) return;
    this.autofocus = value ? -1 : this.tags.length;
    this.tags.push(this.fb.control(value, QtagsFormComponent.validators));
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }
}

export function qtagsForm(fb: UntypedFormBuilder, tags: string[]) {
  return fb.array(map(tags, v => fb.control(v, QtagsFormComponent.validators)));
}
