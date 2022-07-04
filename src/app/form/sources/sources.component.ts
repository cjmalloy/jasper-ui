import { Component, forwardRef, HostBinding, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, NG_VALUE_ACCESSOR, Validators } from '@angular/forms';
import { URI_REGEX } from '../../util/format';

@Component({
  selector: 'app-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss']
})
export class SourcesFormComponent implements OnInit {
  static validators = [Validators.required, Validators.pattern(URI_REGEX)];
  @HostBinding('class') css = 'form-group';

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
    this.sources.push(this.fb.control(value, SourcesFormComponent.validators));
  }

  removeSource(index: number) {
    this.sources.removeAt(index);
  }
}

export function sourcesForm(fb: FormBuilder, urls: string[]) {
  return fb.array(urls.map(v => fb.control(v, SourcesFormComponent.validators)));
}
