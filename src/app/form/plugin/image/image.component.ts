import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { URI_REGEX } from '../../../util/format';

@Component({
  selector: 'app-form-image',
  templateUrl: './image.component.html',
  styleUrls: ['./image.component.scss']
})
export class ImageFormComponent implements OnInit {

  @Input()
  plugins!: FormGroup;
  @Input()
  fieldName = 'plugin/image';

  constructor() {}

  ngOnInit(): void {
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as FormGroup;
  }

  get url() {
    return this.plugin.get('url') as FormControl;
  }
}

export function imagePluginForm(fb: FormBuilder) {
  return fb.group({
    url: fb.control('', [Validators.pattern(URI_REGEX)]),
  });
}

