import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { QUERY_REGEX } from '../../util/format';

@Component({
  selector: 'app-queries',
  templateUrl: './queries.component.html',
  styleUrls: ['./queries.component.scss']
})
export class QueriesFormComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(QUERY_REGEX)];
  @HostBinding('class') css = 'form-group';

  @Input()
  group!: FormGroup;
  @Input()
  fieldName = 'tags';
  @Input()
  label = 'query';

  constructor(
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get queries() {
    return this.group.get(this.fieldName) as FormArray;
  }

  addQuery(value = '') {
    this.queries.push(this.fb.control(value, QueriesFormComponent.validators));
  }

  removeQuery(index: number) {
    this.queries.removeAt(index);
  }
}

export function queriesForm(fb: FormBuilder, tags: string[]) {
  return fb.array(tags.map(v => fb.control(v, QueriesFormComponent.validators)));
}
