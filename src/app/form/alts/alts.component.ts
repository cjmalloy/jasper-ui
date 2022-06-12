import { Component, forwardRef, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { TAG_REGEX, URI_REGEX } from '../../util/format';

@Component({
  selector: 'app-alts',
  templateUrl: './alts.component.html',
  styleUrls: ['./alts.component.scss'],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AltsComponent), multi: true}]
})
export class AltsComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(URI_REGEX)];

  @Input()
  group!: FormGroup;
  @Input()
  fieldName = 'alternateUrls';

  constructor(
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get alts() {
    return this.group.get(this.fieldName) as FormArray;
  }

  addAlt(value = '') {
    this.alts.push(this.fb.control(value, AltsComponent.validators));
  }

  removeAlt(index: number) {
    this.alts.removeAt(index);
  }
}

export function altsForm(fb: FormBuilder, urls: string[]) {
  return fb.array(urls.map(v => fb.control(v, AltsComponent.validators)));
}
