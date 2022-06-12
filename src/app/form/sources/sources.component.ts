import { Component, forwardRef, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { URI_REGEX } from '../../util/format';

@Component({
  selector: 'app-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss'],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SourcesComponent), multi: true}]
})
export class SourcesComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(URI_REGEX)];

  @Input()
  group!: FormGroup;
  @Input()
  fieldName = 'sources';

  constructor(
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get sources() {
    return this.group.get(this.fieldName) as FormArray;
  }

  addSource(value = '') {
    this.sources.push(this.fb.control(value, SourcesComponent.validators));
  }

  removeSource(index: number) {
    this.sources.removeAt(index);
  }
}

export function sourcesForm(fb: FormBuilder, urls: string[]) {
  return fb.array(urls.map(v => fb.control(v, SourcesComponent.validators)));
}
