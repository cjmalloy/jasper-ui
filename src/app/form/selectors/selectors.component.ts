import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { SELECTOR_REGEX } from '../../util/format';

@Component({
  selector: 'app-selectors',
  templateUrl: './selectors.component.html',
  styleUrls: ['./selectors.component.scss']
})
export class SelectorsFormComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(SELECTOR_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'tags';
  @Input()
  label = 'selector';

  constructor(
    private fb: UntypedFormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get tags() {
    return this.group.get(this.fieldName) as UntypedFormArray;
  }

  addTag(value = '') {
    this.tags.push(this.fb.control(value, SelectorsFormComponent.validators));
  }

  removeTag(index: number) {
    this.tags.removeAt(index);
  }
}

export function selectorsForm(fb: UntypedFormBuilder, tags: string[]) {
  return fb.array(tags.map(v => fb.control(v, SelectorsFormComponent.validators)));
}
