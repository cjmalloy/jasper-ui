import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import * as _ from 'lodash-es';
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
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'tags';
  @Input()
  label = $localize`query`;

  constructor(
    private fb: UntypedFormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get queries() {
    return this.group.get(this.fieldName) as UntypedFormArray;
  }

  addQuery(value = '') {
    if (value && this.queries.value.includes(value)) return;
    this.queries.push(this.fb.control(value, QueriesFormComponent.validators));
  }

  removeQuery(index: number) {
    this.queries.removeAt(index);
  }
}

export function queriesForm(fb: UntypedFormBuilder, tags: string[]) {
  return fb.array(_.map(tags, v => fb.control(v, QueriesFormComponent.validators)));
}
